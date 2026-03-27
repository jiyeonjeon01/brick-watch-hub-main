"""
DQN (Deep Q-Network) Agent for Breakout.
CPU 환경 최적화: 84x84 흑백 입력, 경량 신경망.
"""
import random
from collections import deque

import numpy as np

# 단일 소스: API/UI에서 사용하는 기본값
DQN_DEFAULTS = {
    "learning_rate": 0.00025,
    "gamma": 0.99,
    "epsilon_start": 1.0,
    "epsilon_min": 0.01,
    "epsilon_decay": 0.9995,
    "batch_size": 32,
    "replay_buffer_size": 10_000,
    "optimizer": "Adam",
    "input_size": "84×84",
    "hidden_layers": "256 → 128",
    "frame_stack": 4,
}

# Phase 4 황금 밸런스 (학습 최적화)
REWARD_BRICK = 2.0
REWARD_PADDLE = 0.1
REWARD_FALL = -1.0


def _ensure_torch():
    try:
        import torch
        import torch.nn as nn
        import torch.optim as optim
        return torch, nn, optim
    except ImportError as e:
        raise ImportError(
            "PyTorch가 필요합니다: pip install torch"
        ) from e


class DQN:
    """간단한 MLP 기반 Q-Network. 84x84 또는 4×84×84 (프레임 스태킹) 입력."""

    def __init__(self, nn_module, action_size, frame_stack: int = 4):
        in_dim = 84 * 84 * frame_stack
        self._net = nn_module.Sequential(
            nn_module.Linear(in_dim, 256),
            nn_module.ReLU(),
            nn_module.Linear(256, 128),
            nn_module.ReLU(),
            nn_module.Linear(128, action_size),
        )

    def forward(self, x):
        return self._net(x.view(x.size(0), -1))

    def parameters(self):
        return self._net.parameters()

    def to(self, device):
        self._net = self._net.to(device)
        return self


class DQNAgent:
    """Breakout용 DQN 에이전트. CPU 친화적. hyperparams로 오버라이드 가능."""

    def __init__(self, action_size, device="cpu", hyperparams: dict | None = None):
        torch, nn_module, optim_module = _ensure_torch()
        hp_raw = hyperparams or {}
        # camelCase -> snake_case (프론트엔드 호환)
        key_map = {
            "learningRate": "learning_rate",
            "epsilonStart": "epsilon_start",
            "epsilonEnd": "epsilon_min",
            "epsilonDecay": "epsilon_decay",
            "batchSize": "batch_size",
            "replayBufferSize": "replay_buffer_size",
        }
        hp = {**DQN_DEFAULTS}
        for k, v in hp_raw.items():
            key = key_map.get(k, k)
            if v is not None and v != "":
                hp[key] = v
        self.torch = torch
        self.nn = nn_module
        self.device = torch.device(device)
        self.action_size = action_size
        self.frame_stack = int(hp.get("frame_stack", DQN_DEFAULTS["frame_stack"]))

        self.memory = deque(maxlen=int(hp.get("replay_buffer_size", DQN_DEFAULTS["replay_buffer_size"])))
        self.gamma = float(hp.get("gamma", DQN_DEFAULTS["gamma"]))
        self.epsilon = float(hp.get("epsilon_start", DQN_DEFAULTS["epsilon_start"]))
        self.epsilon_min = float(hp.get("epsilon_min", DQN_DEFAULTS["epsilon_min"]))
        self.epsilon_decay = float(hp.get("epsilon_decay", DQN_DEFAULTS["epsilon_decay"]))

        self.model = DQN(nn_module, action_size, self.frame_stack)
        self.model.to(self.device)
        lr = float(hp.get("learning_rate", DQN_DEFAULTS["learning_rate"]))
        self.optimizer = optim_module.Adam(self.model.parameters(), lr=lr)

    def remember(self, state, action, reward, next_state, done):
        """경험 저장."""
        self.memory.append((state, action, reward, next_state, done))

    def act(self, state):
        """ε-greedy: 탐험 vs 학습된 행동."""
        if random.random() <= self.epsilon:
            return random.randrange(self.action_size)

        state_t = self.torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with self.torch.no_grad():
            q = self.model.forward(state_t)
        return int(q.argmax(dim=1).item())

    def save(self, path: str) -> None:
        """모델 가중치 저장."""
        self.torch.save(
            {
                "model": self.model._net.state_dict(),
                "action_size": self.action_size,
                "frame_stack": self.frame_stack,
            },
            path,
        )

    @classmethod
    def load_for_play(cls, path: str, action_size: int, device: str = "cpu") -> "DQNAgent":
        """저장된 모델 로드 (epsilon=0 플레이용)."""
        torch, _, _ = _ensure_torch()
        ckpt = torch.load(path, map_location=device, weights_only=True)
        frame_stack = int(ckpt.get("frame_stack", 1))  # 구버전 호환
        agent = cls(action_size=action_size, device=device, hyperparams={"frame_stack": frame_stack})
        agent.model._net.load_state_dict(ckpt["model"])
        agent.epsilon = 0.0  # 학습 없이 순수 추론
        return agent

    def replay(self, batch_size=32):
        """메모리에서 배치 샘플링 후 학습. 반환: 평균 loss 또는 0."""
        if len(self.memory) < batch_size:
            return 0.0

        batch = random.sample(self.memory, batch_size)
        torch = self.torch
        nn_module = self.nn

        states = torch.FloatTensor(np.array([b[0] for b in batch])).to(self.device)
        actions = torch.LongTensor([b[1] for b in batch]).to(self.device)
        rewards = torch.FloatTensor([b[2] for b in batch]).to(self.device)
        next_states = torch.FloatTensor(np.array([b[3] for b in batch])).to(self.device)
        dones = torch.FloatTensor([b[4] for b in batch]).to(self.device)

        targets = rewards + (1 - dones) * self.gamma * self.model.forward(next_states).max(dim=1)[0]
        current_q = self.model.forward(states).gather(1, actions.unsqueeze(1)).squeeze(1)

        loss_fn = nn_module.MSELoss()
        loss = loss_fn(current_q, targets)

        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()

        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

        return float(loss.item())
