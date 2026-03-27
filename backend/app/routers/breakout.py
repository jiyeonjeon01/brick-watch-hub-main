"""
Breakout RL Simulation WebSocket.
- training: 새 학습 (session_id로 로그 저장, 세션 hyperparams 사용)
- play: 저장된 모델로 게임 (mode=play&session_id=X)
Phase 3: 보상 밸런스, 프레임 스태킹, 목숨별 벌점
"""
import asyncio
import base64
import json
from pathlib import Path
from collections import deque
from typing import List, Tuple

import cv2
import numpy as np

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.dqn_agent import DQNAgent, REWARD_BRICK, REWARD_FALL, REWARD_PADDLE
from app.services.logging_service import flush_logs_async

FRAME_STACK = 4

router = APIRouter(prefix="", tags=["breakout"])

MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"


def _run_env_step(env, action):
    """동기 env.step - 스레드풀에서 실행"""
    return env.step(action)


def _run_env_reset(env):
    return env.reset()


def _preprocess_frame(obs):
    """84x84 흑백 전처리 (단일 프레임)."""
    gray = cv2.cvtColor(obs, cv2.COLOR_RGB2GRAY)
    resized = cv2.resize(gray, (84, 84))
    return resized.astype(np.float32) / 255.0


def _stack_frames(frames: deque, new_frame: np.ndarray) -> np.ndarray:
    """최근 FRAME_STACK장을 쌓아 (C,H,W) 형태로 반환."""
    frames.append(new_frame)
    while len(frames) > FRAME_STACK:
        frames.popleft()
    # 채워지기 전: 가장 오래된 프레임으로 패딩
    while len(frames) < FRAME_STACK:
        frames.appendleft(frames[0] if frames else new_frame)
    return np.stack(list(frames), axis=0)  # (4, 84, 84)


def _create_env():
    import ale_py  # ALE 환경 등록 (gymnasium에 ALE/Breakout-v5 등록)
    import gymnasium as gym

    return gym.make("ALE/Breakout-v5", render_mode="rgb_array")


@router.websocket("/ws/training")
async def training_websocket(websocket: WebSocket):
    """
    ?session_id=123: 학습 모드, DB 로그 저장, 종료 시 모델 저장
    ?mode=play&session_id=123: 플레이 모드, 저장된 모델로 게임 (학습 없음)
    """
    await websocket.accept()

    session_id: int | None = None
    mode = websocket.query_params.get("mode", "training")
    q = websocket.query_params.get("session_id")
    if q and q.isdigit():
        session_id = int(q)

    is_play_mode = mode.lower() == "play"
    log_buffer: List[Tuple[int, int, float, float, float]] = []
    env = None
    agent = None

    try:
        env = await asyncio.to_thread(_create_env)
        action_size = env.action_space.n

        if is_play_mode and session_id is not None:
            # 플레이: 저장된 모델 로드
            model_path = MODELS_DIR / f"session_{session_id}.pt"
            if not model_path.exists():
                await websocket.send_json({
                    "logs": [f"[Error] Session #{session_id} 모델을 찾을 수 없습니다. 먼저 학습을 실행하세요."],
                    "isTraining": False,
                })
                return
            agent = await asyncio.to_thread(
                DQNAgent.load_for_play, str(model_path), action_size, "cpu"
            )
        else:
            hp = None
            if session_id is not None:
                from app.database import get_session_local
                from app.models.training import TrainingSession
                db = get_session_local()()
                try:
                    s = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
                    if s and s.hyperparams:
                        hp = json.loads(s.hyperparams)
                finally:
                    db.close()
            agent = DQNAgent(action_size=action_size, device="cpu", hyperparams=hp)

        obs, reset_info = await asyncio.to_thread(_run_env_reset, env)
        frame_buffer: deque = deque(maxlen=FRAME_STACK)
        state = _stack_frames(frame_buffer, _preprocess_frame(obs))

        episode = 1
        total_reward = 0
        step_count = 0
        last_loss = 0.0
        prev_lives = reset_info.get("lives", 5)

        while True:
            # 1. DQN이 행동 결정
            action = agent.act(state)

            # 2. 게임 진행
            result = await asyncio.to_thread(_run_env_step, env, action)
            next_obs, reward, terminated, truncated, info = result
            step_count += 1
            done = terminated or truncated
            curr_lives = info.get("lives", prev_lives)

            # 2b. Phase 3 보상 형성: 벽돌 +5, 패들 +0.05, 낙하 -5
            if done:
                shaped_reward = REWARD_FALL
            elif reward > 0:
                shaped_reward = REWARD_BRICK
            else:
                shaped_reward = REWARD_PADDLE
            # 목숨 감소 시 추가 벌점 (에피소드 종료 전에도 학습에 반영)
            if curr_lives < prev_lives:
                shaped_reward += REWARD_FALL
            prev_lives = curr_lives
            total_reward += shaped_reward

            # 3. 다음 상태 (프레임 스태킹)
            next_frame = _preprocess_frame(next_obs)
            next_state = _stack_frames(frame_buffer, next_frame)
            if not is_play_mode:
                agent.remember(state, action, shaped_reward, next_state, float(done))

            # 4. 학습 (플레이 모드 제외)
            if not is_play_mode and step_count % 10 == 0:
                last_loss = await asyncio.to_thread(agent.replay, 32)

            # 4b. DB 배치 저장 (학습 모드 + session_id 있을 때)
            if not is_play_mode and session_id is not None:
                log_buffer.append((step_count, episode, shaped_reward, last_loss, agent.epsilon))
                if len(log_buffer) >= 100:
                    await flush_logs_async(session_id, log_buffer.copy())
                    log_buffer.clear()

            # 5. 대시보드용 이미지 (액션 후 화면 = next_obs)
            frame = cv2.cvtColor(next_obs, cv2.COLOR_RGB2BGR)
            frame = cv2.resize(frame, (320, 420))
            _, buffer = cv2.imencode(
                ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70]
            )
            frame_base64 = base64.b64encode(buffer).decode("utf-8")

            payload = {
                "imgFrame": f"data:image/jpeg;base64,{frame_base64}",
                "episode": episode,
                "score": int(total_reward),
                "steps": step_count,
                "reward": float(shaped_reward),
                "loss": round(last_loss, 4),
                "logs": [
                    f"Step {step_count}: Action {action} | Reward {shaped_reward:.2f} | "
                    + (f"Epsilon {agent.epsilon:.3f} | Loss {last_loss:.4f}" if not is_play_mode else "[Play Mode]")
                ],
            }

            await websocket.send_json(payload)

            if done:
                obs, reset_info = await asyncio.to_thread(_run_env_reset, env)
                frame_buffer.clear()
                state = _stack_frames(frame_buffer, _preprocess_frame(obs))
                prev_lives = reset_info.get("lives", 5)
                episode += 1
                total_reward = 0
                step_count = 0
            else:
                state = next_state
                obs = next_obs

            await asyncio.sleep(0.033)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json(
                {"logs": [f"[Error] {type(e).__name__}: {e}"], "isTraining": False}
            )
        except Exception:
            pass
    finally:
        if not is_play_mode and session_id is not None and log_buffer:
            try:
                await flush_logs_async(session_id, log_buffer)
            except Exception:
                pass
        # 학습 모드: 종료 시 모델 저장
        if not is_play_mode and session_id is not None and agent is not None:
            try:
                MODELS_DIR.mkdir(parents=True, exist_ok=True)
                path = MODELS_DIR / f"session_{session_id}.pt"
                await asyncio.to_thread(agent.save, str(path))
            except Exception:
                pass
        if env is not None:
            try:
                env.close()
            except Exception:
                pass
