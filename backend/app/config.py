"""
설정: 모든 DB/URL/비밀번호 등은 환경변수(.env)에서만 로드.
하드코딩 금지 - 다른 사용자가 본인 user/password로 사용 가능해야 함.
"""
import os
from pathlib import Path


def _get_env(key: str) -> str:
    """환경변수 조회. 없으면 빈 문자열 (하드코딩 없음)."""
    return os.environ.get(key, "")


def get_database_url() -> str:
    """
    DATABASE_URL이 있으면 사용, 없으면 DB_* 환경변수로 조합.
    모든 값은 env에서만.
    """
    url = _get_env("DATABASE_URL").strip()
    if url:
        return url
    host = _get_env("DB_HOST") or "localhost"
    port = _get_env("DB_PORT") or "5432"
    user = _get_env("DB_USER")
    password = _get_env("DB_PASSWORD")
    dbname = _get_env("DB_NAME")
    if not all([user, password, dbname]):
        return ""
    return f"postgresql://{user}:{password}@{host}:{port}/{dbname}"


def get_database_url_for_create() -> str:
    """
    DB 생성 시 사용: postgres 기본 DB에 연결 (brick-db 생성 전).
    CREATE DATABASE를 실행하려면 기본 postgres DB에 먼저 연결해야 함.
    """
    url = _get_env("DATABASE_URL").strip()
    if url:
        if "/" in url.rstrip("/"):
            base = url.rsplit("/", 1)[0]
            return f"{base}/postgres"
        return url
    host = _get_env("DB_HOST") or "localhost"
    port = _get_env("DB_PORT") or "5432"
    user = _get_env("DB_USER")
    password = _get_env("DB_PASSWORD")
    if not all([user, password]):
        return ""
    return f"postgresql://{user}:{password}@{host}:{port}/postgres"


def get_db_name() -> str:
    """DB 이름 (env만)."""
    return _get_env("DB_NAME")


def get_db_params() -> dict:
    """
    psycopg2.connect()에 전달할 kwargs (URL 대신 개별 파라미터 사용).
    한글/특수문자 비밀번호 등 인코딩 이슈 방지.
    """
    host = _get_env("DB_HOST") or "localhost"
    port_str = _get_env("DB_PORT") or "5432"
    user = _get_env("DB_USER")
    password = _get_env("DB_PASSWORD")
    dbname = _get_env("DB_NAME")
    return {
        "host": host,
        "port": int(port_str) if port_str.isdigit() else 5432,
        "user": user,
        "password": password,
        "dbname": dbname,
    }


def load_dotenv_if_exists() -> None:
    """프로젝트 루트의 .env 파일 로드 (있을 경우)."""
    try:
        from dotenv import load_dotenv
        root = Path(__file__).resolve().parent.parent
        env_path = root / ".env"
        if env_path.exists():
            for enc in ("utf-8", "utf-8-sig", "cp949"):
                try:
                    load_dotenv(env_path, encoding=enc)
                    break
                except UnicodeDecodeError:
                    continue
    except ImportError:
        pass
