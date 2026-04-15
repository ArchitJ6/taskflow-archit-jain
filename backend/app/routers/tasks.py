import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.task import Task, TaskStatus
from app.realtime import publish_task_event
from app.schemas.task import TaskCreate, TaskUpdate, TaskOut, PaginatedTasks

router = APIRouter(tags=["tasks"])


async def get_project_or_404(project_id: uuid.UUID, db: AsyncSession) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail={"error": "not found"})
    return p


async def ensure_project_access(project_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Project:
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .where(
            or_(
                Project.owner_id == user_id,
                Project.id.in_(
                    select(Task.project_id).where(Task.assignee_id == user_id)
                ),
            )
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail={"error": "not found"})
    return project


async def get_task_or_404(task_id: uuid.UUID, db: AsyncSession) -> Task:
    result = await db.execute(select(Task).where(Task.id == task_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail={"error": "not found"})
    return t


@router.get("/projects/{project_id}/tasks", response_model=PaginatedTasks)
async def list_tasks(
    project_id: uuid.UUID,
    status: Optional[TaskStatus] = Query(None),
    assignee: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await ensure_project_access(project_id, current_user.id, db)

    stmt = select(Task).where(Task.project_id == project_id)
    if status is not None:
        stmt = stmt.where(Task.status == status)
    if assignee is not None:
        if assignee == "unassigned":
            stmt = stmt.where(Task.assignee_id.is_(None))
        else:
            try:
                assignee_id = uuid.UUID(assignee)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail={"error": "validation failed", "fields": {"assignee": "must be a UUID or 'unassigned'"}},
                )
            stmt = stmt.where(Task.assignee_id == assignee_id)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(Task.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    tasks = result.scalars().all()

    return PaginatedTasks(
        tasks=[TaskOut.model_validate(t) for t in tasks],
        total=total,
        page=page,
        limit=limit,
    )


@router.post("/projects/{project_id}/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: uuid.UUID,
    body: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await ensure_project_access(project_id, current_user.id, db)

    if not body.title or not body.title.strip():
        raise HTTPException(
            status_code=400,
            detail={"error": "validation failed", "fields": {"title": "is required"}},
        )

    task = Task(
        title=body.title.strip(),
        description=body.description,
        status=body.status,
        priority=body.priority,
        project_id=project_id,
        assignee_id=body.assignee_id,
        created_by_id=current_user.id,
        due_date=body.due_date,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    await publish_task_event({
        "event": "task.created",
        "task_id": str(task.id),
        "project_id": str(task.project_id),
    })
    return TaskOut.model_validate(task)


@router.patch("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID,
    body: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await get_task_or_404(task_id, db)
    project = await get_project_or_404(task.project_id, db)

    if body.status is not None:
        can_update_status = (
            project.owner_id == current_user.id
            or task.created_by_id == current_user.id
            or task.assignee_id == current_user.id
        )
        if not can_update_status:
            raise HTTPException(status_code=403, detail={"error": "forbidden"})

    if body.title is not None:
        task.title = body.title.strip()
    if body.description is not None:
        task.description = body.description
    if body.status is not None:
        task.status = body.status
    if body.priority is not None:
        task.priority = body.priority
    if body.assignee_id is not None:
        task.assignee_id = body.assignee_id
    if body.due_date is not None:
        task.due_date = body.due_date

    from datetime import datetime, timezone
    task.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(task)
    await publish_task_event({
        "event": "task.updated",
        "task_id": str(task.id),
        "project_id": str(task.project_id),
    })
    return TaskOut.model_validate(task)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await get_task_or_404(task_id, db)

    # Project owner or task creator can delete
    project = await get_project_or_404(task.project_id, db)
    if project.owner_id != current_user.id and task.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail={"error": "forbidden"})

    project_id = task.project_id
    task_id = task.id
    await db.delete(task)
    await db.commit()
    await publish_task_event({
        "event": "task.deleted",
        "task_id": str(task_id),
        "project_id": str(project_id),
    })
