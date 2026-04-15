import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut, ProjectStats
from app.schemas.task import TaskOut

router = APIRouter(prefix="/projects", tags=["projects"])


async def get_project_or_404(project_id: uuid.UUID, db: AsyncSession) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail={"error": "not found"})
    return project


async def ensure_project_access(project_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Project:
    assigned_subq = select(Task.project_id).where(Task.assignee_id == user_id).scalar_subquery()
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .where(
            or_(
                Project.owner_id == user_id,
                Project.id.in_(assigned_subq),
            )
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail={"error": "not found"})
    return project


@router.get("", response_model=dict)
async def list_projects(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List projects the user owns or has tasks assigned in."""
    # Subquery: project IDs where the user is assigned a task
    assigned_subq = (
        select(Task.project_id)
        .where(Task.assignee_id == current_user.id)
        .scalar_subquery()
    )

    stmt = (
        select(Project)
        .where(
            or_(
                Project.owner_id == current_user.id,
                Project.id.in_(assigned_subq),
            )
        )
        .order_by(Project.created_at.desc())
    )

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    # Paginate
    stmt = stmt.offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    projects = result.scalars().all()

    return {
        "projects": [ProjectOut.model_validate(p) for p in projects],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.name or not body.name.strip():
        raise HTTPException(
            status_code=400,
            detail={"error": "validation failed", "fields": {"name": "is required"}},
        )
    project = Project(name=body.name.strip(), description=body.description, owner_id=current_user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectOut.model_validate(project)


@router.get("/{project_id}", response_model=dict)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await ensure_project_access(project_id, current_user.id, db)

    result = await db.execute(
        select(Project)
        .options(selectinload(Project.tasks))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail={"error": "not found"})

    return {
        **ProjectOut.model_validate(project).model_dump(),
        "tasks": [TaskOut.model_validate(t) for t in project.tasks],
    }


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await get_project_or_404(project_id, db)
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail={"error": "forbidden"})

    if body.name is not None:
        project.name = body.name.strip()
    if body.description is not None:
        project.description = body.description

    await db.commit()
    await db.refresh(project)
    return ProjectOut.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await get_project_or_404(project_id, db)
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail={"error": "forbidden"})

    await db.delete(project)
    await db.commit()


@router.get("/{project_id}/stats", response_model=ProjectStats)
async def get_project_stats(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await ensure_project_access(project_id, current_user.id, db)

    # Count by status
    status_counts = await db.execute(
        select(Task.status, func.count(Task.id))
        .where(Task.project_id == project_id)
        .group_by(Task.status)
    )
    by_status = {str(row[0].value): row[1] for row in status_counts}

    # Count by assignee
    assignee_counts = await db.execute(
        select(Task.assignee_id, func.count(Task.id))
        .where(Task.project_id == project_id)
        .group_by(Task.assignee_id)
    )
    by_assignee = {
        str(row[0]) if row[0] else "unassigned": row[1]
        for row in assignee_counts
    }

    # Total
    total_result = await db.execute(
        select(func.count(Task.id)).where(Task.project_id == project_id)
    )
    total = total_result.scalar_one()

    return ProjectStats(total=total, by_status=by_status, by_assignee=by_assignee)
