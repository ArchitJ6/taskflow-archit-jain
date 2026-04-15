import asyncio
import json
from typing import Any

_task_subscribers: list[asyncio.Queue[str]] = []


def subscribe_task_events() -> asyncio.Queue[str]:
    queue: asyncio.Queue[str] = asyncio.Queue()
    _task_subscribers.append(queue)
    return queue


def unsubscribe_task_events(queue: asyncio.Queue[str]) -> None:
    if queue in _task_subscribers:
        _task_subscribers.remove(queue)


async def publish_task_event(event: dict[str, Any]) -> None:
    if not _task_subscribers:
        return

    payload = json.dumps(event)
    for queue in list(_task_subscribers):
        await queue.put(payload)
