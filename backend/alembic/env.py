"""
Alembic env: DB URL은 환경변수에서만 로드 (하드코딩 금지).
"""
import sys
from pathlib import Path

# 프로젝트 루트를 path에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
from app.config import load_dotenv_if_exists, get_database_url

load_dotenv_if_exists()
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 환경변수에서 URL 로드 (하드코딩 없음)
url = get_database_url()
if not url:
    raise RuntimeError(
        "DATABASE_URL 또는 DB_USER, DB_PASSWORD, DB_NAME 등을 .env에 설정하세요."
    )
config.set_main_option("sqlalchemy.url", url)

from app.database import Base
import app.models  # noqa: F401 - 모델 메타데이터 등록용

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
