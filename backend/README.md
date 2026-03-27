# Brick Watch Hub - Backend

Python 3.12 + FastAPI + PostgreSQL + Alembic

## 환경변수

`.env.example`를 `.env`로 복사한 뒤 본인 환경에 맞게 수정하세요. **DB 비밀번호·유저·DB명 등은 절대 하드코딩하지 않습니다.**

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=brick-user
DB_PASSWORD=your_password_here
DB_NAME=brick-db
```

## 초기 설정

```powershell
# 1. 가상환경 생성 및 활성화 (Python 3.12)
py -3.12 -m venv venv
.\venv\Scripts\activate

# 2. 의존성 설치
pip install -r requirements.txt

# 3. .env 설정 (DB_USER, DB_PASSWORD, DB_NAME 등)
copy .env.example .env
# .env 파일 수정

# 4. DB 생성 + 테이블 마이그레이션
py scripts/setup_database.py
```

`setup_database.py`는 다음을 수행합니다:
- `brick-db` 데이터베이스 생성 (없을 경우)
- `alembic upgrade head`로 테이블 생성

**참고**: `brick-user`가 DB를 생성하려면 PostgreSQL에서 `CREATEDB` 권한이 필요합니다.
로컬에서는 `postgres` 슈퍼유저로 `CREATE USER "brick-user" WITH PASSWORD '비밀번호' CREATEDB;`로 생성 가능합니다.

## 실행

```powershell
.\venv\Scripts\activate
uvicorn app.main:app --reload
```

## 프로젝트 구조

```
backend/
├── app/
│   ├── config.py      # 환경변수만 사용 (하드코딩 없음)
│   ├── database.py
│   ├── main.py
│   └── models/
├── alembic/
│   ├── versions/
│   └── env.py
├── scripts/
│   └── setup_database.py
├── .env.example
├── requirements.txt
└── README.md
```
