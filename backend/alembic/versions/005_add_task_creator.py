"""Add task creator relation

Revision ID: 005
Revises: 004
Create Date: 2026-04-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True))

    # Backfill from project owner for existing tasks.
    op.execute(
        """
        UPDATE tasks t
        SET created_by_id = p.owner_id
        FROM projects p
        WHERE t.project_id = p.id
          AND t.created_by_id IS NULL
        """
    )

    op.alter_column("tasks", "created_by_id", nullable=False)
    op.create_index("ix_tasks_created_by_id", "tasks", ["created_by_id"])
    op.create_foreign_key(
        "fk_tasks_created_by_id_users",
        "tasks",
        "users",
        ["created_by_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_tasks_created_by_id_users", "tasks", type_="foreignkey")
    op.drop_index("ix_tasks_created_by_id", table_name="tasks")
    op.drop_column("tasks", "created_by_id")
