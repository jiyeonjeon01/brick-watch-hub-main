"""
DB 초기 구성: brick-user 생성 → brick-db 생성 → alembic upgrade head로 테이블 생성.
postgres 관리자(PG_ADMIN_*)로 사용자/DB 생성. 환경변수(.env)에서만 로드.
실행: venv 활성화 후 > py scripts/setup_database.py
"""
import os
import sys
from pathlib import Path

# 프로젝트 루트 추가
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# .env 로드 (한글 Windows 인코딩 이슈 방지)
try:
    from dotenv import load_dotenv
    env_path = ROOT / ".env"
    if env_path.exists():
        for enc in ("utf-8", "utf-8-sig", "cp949"):
            try:
                load_dotenv(env_path, encoding=enc)
                break
            except UnicodeDecodeError:
                continue
except ImportError:
    pass

from app.config import (
    get_database_url,
    get_db_params,
    get_db_name,
    load_dotenv_if_exists,
)

load_dotenv_if_exists()


def create_user_and_database_if_not_exists() -> None:
    """postgres 관리자로 연결 → brick-user 생성 → brick-db 생성"""
    db_name = get_db_name()
    if not db_name:
        raise SystemExit("DB_NAME 환경변수가 비어 있습니다. .env를 확인하세요.")

    params = get_db_params()
    db_user = params.get("user")
    db_password = params.get("password")
    if not db_user:
        raise SystemExit("DB_USER이 .env에 없습니다.")

    # 관리자 계정: PG_ADMIN_USER 있으면 사용, 없으면 postgres
    admin_user = os.environ.get("PG_ADMIN_USER", "postgres").strip()
    admin_password = os.environ.get("PG_ADMIN_PASSWORD", "").strip()
    if not admin_password:
        admin_password = os.environ.get("DB_PASSWORD", "").strip()
    if not admin_password:
        raise SystemExit(
            "PG_ADMIN_PASSWORD 또는 DB_PASSWORD가 .env에 필요합니다. "
            "(postgres 비밀번호로 DB_USER/DB 생성용)"
        )

    try:
        import pg8000.dbapi
    except ImportError:
        raise SystemExit("pg8000이 필요합니다: pip install pg8000")

    admin_params = {
        "host": params.get("host", "localhost"),
        "port": params.get("port", 5432),
        "user": admin_user,
        "password": admin_password,
        "database": "postgres",
    }

    conn = None
    try:
        conn = pg8000.dbapi.connect(**admin_params)
        conn.autocommit = True
        cur = conn.cursor()

        # 1. brick-user 생성 (없으면)
        cur.execute(
            "SELECT 1 FROM pg_roles WHERE rolname = %s",
            (db_user,),
        )
        if cur.fetchone() is None:
            pw_esc = (db_password or "").replace("'", "''")
            cur.execute(f'CREATE USER "{db_user}" WITH PASSWORD \'{pw_esc}\' CREATEDB')
            print(f"사용자 '{db_user}' 생성 완료.")
        else:
            print(f"사용자 '{db_user}'가 이미 존재합니다.")

        # 2. brick-db 생성 (없으면)
        cur.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (db_name,),
        )
        if cur.fetchone() is None:
            cur.execute(f'CREATE DATABASE "{db_name}" OWNER "{db_user}"')
            print(f"데이터베이스 '{db_name}' 생성 완료.")
        else:
            print(f"데이터베이스 '{db_name}'가 이미 존재합니다.")

        cur.close()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise SystemExit(f"DB 생성 실패: {e}")
    finally:
        if conn:
            conn.close()


def run_alembic_upgrade() -> None:
    if not get_database_url():
        raise SystemExit(
            "DATABASE_URL 또는 DB_* 환경변수로 brick-db URL을 구성할 수 없습니다."
        )

    import subprocess
    os.chdir(ROOT)
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        capture_output=False,
    )
    if result.returncode != 0:
        raise SystemExit(f"alembic upgrade head 실패 (코드 {result.returncode})")
    print("alembic upgrade head 완료.")


def main() -> None:
    print("=== setup_database: DB 사용자/DB 생성 + 마이그레이션 ===\n")
    create_user_and_database_if_not_exists()
    run_alembic_upgrade()
    print("\n설정 완료.")


if __name__ == "__main__":
    main()
