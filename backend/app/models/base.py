"""
예시 모델. 필요한 테이블은 여기 추가하거나 별도 모델 파일로 분리.
"""
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database import Base  # noqa: F401 - alembic에서 사용


class BaseMixin:
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
