"""
FastAPI 메인 앱. DB/설정은 환경변수에서만 로드.
Breakout RL 시뮬레이터 WebSocket: /ws/training
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import load_dotenv_if_exists
from app.routers import breakout, training_history

load_dotenv_if_exists()

app = FastAPI(
    title="Brick Watch Hub API",
    version="0.1.0",
)

app.include_router(breakout.router)
app.include_router(training_history.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Brick Watch Hub API", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "healthy"}
