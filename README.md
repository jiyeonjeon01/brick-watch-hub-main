# Brick Watch Hub

Atari **Breakout** 환경에서 **DQN(Deep Q-Network) 강화학습**을 실행하고, 학습 과정을 **실시간으로 모니터링**할 수 있는 웹 대시보드입니다. WebSocket을 통해 게임 화면과 학습 지표를 스트리밍하며, 학습 기록은 PostgreSQL에 저장됩니다.

## 주요 기능

- **실시간 학습 모니터링** — WebSocket으로 게임 화면 및 보상·손실·엡실론 등 지표를 라이브 스트리밍
- **학습 세션 관리** — 세션 시작/종료, 하이퍼파라미터 설정, 학습된 모델(`.pt`) 자동 저장
- **플레이 모드** — 저장된 모델을 로드하여 추론 전용 플레이 시연
- **학습 히스토리** — 과거 세션별 보상 추이·에피소드 차트 조회
- **학습 분석** — 세션·DQN 설정 기반 분석 차트 및 통계 테이블
- **시스템 로그** — DB에 저장된 학습 로그 검색·필터링
- **설정** — WebSocket URL, DQN 하이퍼파라미터 커스터마이징

## 기술 스택

### 프론트엔드

| 분류 | 기술 |
|------|------|
| 프레임워크 | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui (Radix UI) |
| 상태·데이터 | TanStack React Query, React Hook Form, Zod |
| 차트 | Recharts |
| 라우팅 | React Router v6 |
| 테스트 | Vitest, Playwright |

### 백엔드

| 분류 | 기술 |
|------|------|
| 프레임워크 | FastAPI, Uvicorn |
| 강화학습 | PyTorch, Gymnasium (Atari) |
| 데이터베이스 | PostgreSQL, SQLAlchemy, Alembic |
| 실시간 통신 | WebSocket |

## 프로젝트 구조

```
brick-watch-hub-main/
├── frontend/
│   ├── src/
│   │   ├── pages/           # Index, History, TrainingAnalysis, SystemLogs, Settings
│   │   ├── components/
│   │   │   ├── dashboard/   # MetricCards, LiveView, TrainingCharts, ConsoleLog
│   │   │   └── ui/          # shadcn/ui 컴포넌트
│   │   ├── hooks/           # useBreakoutData, use-toast, use-mobile
│   │   ├── lib/             # api.ts, utils.ts
│   │   └── types/           # breakout.ts
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI 앱 엔트리포인트
│   │   ├── config.py        # 환경변수 설정
│   │   ├── database.py      # DB 연결
│   │   ├── dqn_agent.py     # DQN 에이전트 구현
│   │   ├── routers/         # breakout (WebSocket), training_history (REST)
│   │   ├── services/        # logging_service
│   │   └── models/          # TrainingSession, TrainingLog
│   ├── alembic/             # DB 마이그레이션
│   ├── scripts/             # setup_database.py
│   ├── models/              # 학습된 모델 저장 (session_{id}.pt)
│   └── requirements.txt
└── README.md
```

## 시작하기

### 사전 요구사항

- **Python 3.12+**
- **Node.js 18+**
- **PostgreSQL**

### 1. 백엔드 설정

```powershell
cd backend

# 가상환경 생성 및 활성화
py -3.12 -m venv venv
.\venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정
copy .env.example .env
# .env 파일을 열어 DB 정보를 입력하세요
```

`.env` 파일 예시:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=brick-user
DB_PASSWORD=your_password_here
DB_NAME=brick-db
```

> **참고**: `brick-user`에게 PostgreSQL `CREATEDB` 권한이 필요합니다.
> `postgres` 슈퍼유저로 `CREATE USER "brick-user" WITH PASSWORD '비밀번호' CREATEDB;`를 실행하세요.

```powershell
# 데이터베이스 생성 + 마이그레이션
py scripts/setup_database.py

# 서버 실행 (포트 9900)
uvicorn app.main:app --reload --port 9900
```

### 2. 프론트엔드 설정

```powershell
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행 (포트 9090)
npm run dev
```

### 3. 접속

브라우저에서 **http://localhost:9090** 으로 접속합니다.

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/start-session` | 학습 세션 시작 |
| `POST` | `/end-session/{id}` | 학습 세션 종료 |
| `GET` | `/sessions` | 전체 세션 목록 |
| `GET` | `/history/{id}` | 세션별 학습 기록 |
| `GET` | `/logs` | 시스템 로그 조회 |
| `GET` | `/config/dqn` | DQN 기본 설정값 |
| `GET` | `/playable-sessions` | 플레이 가능 세션 목록 |
| `WS` | `/ws/training` | 실시간 학습 스트리밍 |

## 환경 변수

### 백엔드

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DB_HOST` | PostgreSQL 호스트 | `localhost` |
| `DB_PORT` | PostgreSQL 포트 | `5432` |
| `DB_USER` | DB 사용자명 | - |
| `DB_PASSWORD` | DB 비밀번호 | - |
| `DB_NAME` | 데이터베이스명 | - |

### 프론트엔드

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `VITE_API_URL` | 백엔드 REST API URL | `http://localhost:9900` |

WebSocket URL은 프론트엔드 Settings 페이지에서 변경할 수 있습니다.

## 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.
