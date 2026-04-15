import asyncio

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt

from app.config import settings
from app.realtime import subscribe_task_events, unsubscribe_task_events

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/tasks")
async def task_events(token: str = Query(...)):
    try:
        jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail={"error": "unauthorized"})

    queue = subscribe_task_events()

    async def event_generator():
        try:
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=20)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            unsubscribe_task_events(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
