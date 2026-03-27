"""
DB 엔진/세션. URL은 config를 통해 환경변수에서만 로드.
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.config import load_dotenv_if_exists, get_database_url

load_dotenv_if_exists()
Base = declarative_base()
DATABASE_URL = get_database_url()

_engine = None
_SessionLocal = None


def _get_engine():
    global _engine
    if _engine is None:
        if not DATABASE_URL:
            raise RuntimeError(
                "DATABASE_URL 또는 DB_* 환경변수를 .env에 설정하세요."
            )
        _engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            echo=False,
        )
    return _engine


def get_session_local():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=_get_engine(),
        )
    return _SessionLocal


def get_db():
    """의존성: DB 세션."""
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
