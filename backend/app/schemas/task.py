import uuid
from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel

from app.models.task import TaskStatus, TaskPriority


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.medium
    assignee_id: Optional[uuid.UUID] = None
    due_date: Optional[date] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[uuid.UUID] = None
    due_date: Optional[date] = None


class TaskOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    title: str
    description: Optional[str]
    status: TaskStatus
    priority: TaskPriority
    project_id: uuid.UUID
    assignee_id: Optional[uuid.UUID]
    created_by_id: uuid.UUID
    due_date: Optional[date]
    created_at: datetime
    updated_at: datetime


class PaginatedTasks(BaseModel):
    tasks: list[TaskOut]
    total: int
    page: int
    limit: int
