"""
학습 로그 배치 DB 저장.
비동기 WebSocket 루프에 영향 주지 않도록 스레드풀에서 실행.
"""
import asyncio
from typing import List, Tuple


def _flush_logs_sync(session_id: int, rows: List[Tuple[int, int, float, float, float]]) -> None:
    """동기 배치 INSERT (스레드풀에서 호출)."""
    if not rows:
        return

    from app.database import get_session_local
    from app.models.training import TrainingLog

    db = get_session_local()()
    try:
        for step, episode, reward, loss, epsilon in rows:
            log = TrainingLog(
                session_id=session_id,
                step=step,
                episode=episode,
                reward=reward,
                loss=loss,
                epsilon=epsilon,
            )
            db.add(log)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def flush_logs_async(
    session_id: int,
    rows: List[Tuple[int, int, float, float, float]],
) -> None:
    """배치 INSERT를 스레드풀에서 비동기 실행."""
    if not rows:
        return
    await asyncio.to_thread(_flush_logs_sync, session_id, rows)
