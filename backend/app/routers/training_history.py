"""
학습 세션 및 로그 API.
/start-session: 새 세션 생성 (hyperparams 옵션)
/history/{session_id}: 과거 세션 로그 조회
/playable-sessions: 저장된 모델이 있는 세션 (플레이 모드용)
"""
import json
from pathlib import Path
from typing import Any, List

from fastapi import APIRouter, Depends, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_session_local
from app.models.training import TrainingSession, TrainingLog

router = APIRouter(prefix="", tags=["training-history"])


def get_db():
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class StartSessionResponse(BaseModel):
    session_id: int


class TrainingLogRow(BaseModel):
    step: int
    episode: int
    reward: float
    loss: float
    epsilon: float
    created_at: str

    class Config:
        from_attributes = True


class SessionSummary(BaseModel):
    id: int
    start_time: str
    end_time: str | None
    target_type: str
    notes: str | None
    hyperparams: dict | None = None


@router.post("/start-session", response_model=StartSessionResponse)
def start_session(
    notes: str | None = None,
    target_type: str = "breakout",
    hyperparams: dict[str, Any] | None = Body(None),
    db: Session = Depends(get_db),
):
    """새 학습 세션 생성. hyperparams 있으면 DB에 저장 (History/Training Analysis에서 확인)."""
    hp_json = json.dumps(hyperparams) if hyperparams else None
    session = TrainingSession(
        target_type=target_type,
        notes=notes,
        hyperparams=hp_json,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return StartSessionResponse(session_id=session.id)


@router.post("/end-session/{session_id}")
def end_session(session_id: int, db: Session = Depends(get_db)):
    """학습 세션 종료 시 end_time 기록."""
    from sqlalchemy import update
    from datetime import datetime, timezone

    stmt = (
        update(TrainingSession)
        .where(TrainingSession.id == session_id)
        .values(end_time=datetime.now(timezone.utc))
    )
    db.execute(stmt)
    db.commit()
    return {"ok": True}


class SystemLogRow(BaseModel):
    id: int
    session_id: int
    step: int
    episode: int
    reward: float
    loss: float
    epsilon: float
    created_at: str


@router.get("/logs", response_model=List[SystemLogRow])
def get_logs(session_id: int | None = None, limit: int = 500, db: Session = Depends(get_db)):
    """시스템 로그 페이지용: training_logs 조회. session_id 생략 시 전체."""
    q = db.query(TrainingLog).order_by(TrainingLog.created_at.desc())
    if session_id is not None:
        q = q.filter(TrainingLog.session_id == session_id)
    rows = q.limit(limit).all()
    return [
        SystemLogRow(
            id=l.id,
            session_id=l.session_id,
            step=l.step,
            episode=l.episode,
            reward=float(l.reward),
            loss=float(l.loss),
            epsilon=float(l.epsilon),
            created_at=l.created_at.isoformat() if l.created_at else "",
        )
        for l in reversed(rows)
    ]


@router.get("/history/{session_id}", response_model=List[TrainingLogRow])
def get_history(session_id: int, db: Session = Depends(get_db)):
    """특정 세션의 모든 로그 조회 (차트용)."""
    logs = (
        db.query(TrainingLog)
        .filter(TrainingLog.session_id == session_id)
        .order_by(TrainingLog.created_at)
        .all()
    )
    return [
        TrainingLogRow(
            step=l.step,
            episode=l.episode,
            reward=float(l.reward),
            loss=float(l.loss),
            epsilon=float(l.epsilon),
            created_at=l.created_at.isoformat() if l.created_at else "",
        )
        for l in logs
    ]


@router.get("/sessions", response_model=List[SessionSummary])
def list_sessions(db: Session = Depends(get_db)):
    """모든 학습 세션 목록 (과거 실행 선택용)."""
    sessions = (
        db.query(TrainingSession)
        .order_by(TrainingSession.start_time.desc())
        .limit(100)
        .all()
    )
    return [
        SessionSummary(
            id=s.id,
            start_time=s.start_time.isoformat() if s.start_time else "",
            end_time=s.end_time.isoformat() if s.end_time else None,
            target_type=s.target_type or "breakout",
            notes=s.notes,
            hyperparams=json.loads(s.hyperparams) if s.hyperparams else None,
        )
        for s in sessions
    ]


def _models_dir() -> Path:
    return Path(__file__).resolve().parent.parent.parent / "models"


@router.get("/config/dqn")
def get_dqn_config():
    """실제 DQN 에이전트 하이퍼파라미터 (단일 소스)."""
    from app.dqn_agent import DQN_DEFAULTS

    return {
        "algorithm": "DQN (Deep Q-Network)",
        "learning_rate": DQN_DEFAULTS["learning_rate"],
        "gamma": DQN_DEFAULTS["gamma"],
        "epsilon_start": DQN_DEFAULTS["epsilon_start"],
        "epsilon_min": DQN_DEFAULTS["epsilon_min"],
        "epsilon_decay": DQN_DEFAULTS["epsilon_decay"],
        "batch_size": DQN_DEFAULTS["batch_size"],
        "replay_buffer_size": DQN_DEFAULTS["replay_buffer_size"],
        "optimizer": DQN_DEFAULTS["optimizer"],
        "network": f"{DQN_DEFAULTS['input_size']} → {DQN_DEFAULTS['hidden_layers']} → actions",
    }


@router.get("/playable-sessions", response_model=List[SessionSummary])
def list_playable_sessions(db: Session = Depends(get_db)):
    """저장된 모델이 있는 세션만 반환 (대시보드 플레이 모드용)."""
    models_dir = _models_dir()
    if not models_dir.exists():
        return []

    playable_ids = set()
    for f in models_dir.glob("session_*.pt"):
        try:
            sid = int(f.stem.replace("session_", ""))
            playable_ids.add(sid)
        except ValueError:
            continue

    if not playable_ids:
        return []

    sessions = (
        db.query(TrainingSession)
        .filter(TrainingSession.id.in_(playable_ids))
        .order_by(TrainingSession.start_time.desc())
        .all()
    )
    return [
        SessionSummary(
            id=s.id,
            start_time=s.start_time.isoformat() if s.start_time else "",
            end_time=s.end_time.isoformat() if s.end_time else None,
            target_type=s.target_type or "breakout",
            notes=s.notes,
            hyperparams=json.loads(s.hyperparams) if s.hyperparams else None,
        )
        for s in sessions
    ]
