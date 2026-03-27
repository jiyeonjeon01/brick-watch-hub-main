"""
학습 세션 및 로그 모델.
대규모 로그 데이터 처리를 위한 PostgreSQL 테이블.
"""
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Text,
    Numeric,
    DateTime,
    ForeignKey,
)
from sqlalchemy.sql import func

from app.database import Base


class TrainingSession(Base):
    """학습 세션 마스터 테이블."""

    __tablename__ = "training_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    target_type = Column(String(50), default="breakout")
    notes = Column(Text, nullable=True)
    hyperparams = Column(Text, nullable=True)  # JSON: 학습 시 사용된 하이퍼파라미터


class TrainingLog(Base):
    """상세 학습 로그 테이블."""

    __tablename__ = "training_logs"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    session_id = Column(
        Integer,
        ForeignKey("training_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step = Column(Integer, nullable=False)
    episode = Column(Integer, nullable=False)
    reward = Column(Numeric(10, 4), nullable=False)
    loss = Column(Numeric(10, 6), nullable=False)
    epsilon = Column(Numeric(5, 4), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
