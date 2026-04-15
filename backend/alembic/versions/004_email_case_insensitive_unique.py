"""Enforce case-insensitive unique emails

Revision ID: 004
Revises: 003
Create Date: 2026-04-15

"""
from typing import Sequence, Union

from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Normalize stored emails to lowercase before adding case-insensitive uniqueness.
    op.execute("UPDATE users SET email = lower(trim(email))")

    # Merge duplicate users that differ only by email casing:
    # keep the oldest record and re-point foreign keys from duplicates.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                lower(email) AS normalized_email,
                row_number() OVER (
                    PARTITION BY lower(email)
                    ORDER BY created_at ASC, id ASC
                ) AS rn
            FROM users
        ),
        mapping AS (
            SELECT d.id AS duplicate_id, k.id AS keep_id
            FROM ranked d
            JOIN ranked k
                ON d.normalized_email = k.normalized_email
               AND k.rn = 1
            WHERE d.rn > 1
        )
        UPDATE projects p
        SET owner_id = m.keep_id
        FROM mapping m
        WHERE p.owner_id = m.duplicate_id
        """
    )

    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                lower(email) AS normalized_email,
                row_number() OVER (
                    PARTITION BY lower(email)
                    ORDER BY created_at ASC, id ASC
                ) AS rn
            FROM users
        ),
        mapping AS (
            SELECT d.id AS duplicate_id, k.id AS keep_id
            FROM ranked d
            JOIN ranked k
                ON d.normalized_email = k.normalized_email
               AND k.rn = 1
            WHERE d.rn > 1
        )
        UPDATE tasks t
        SET assignee_id = m.keep_id
        FROM mapping m
        WHERE t.assignee_id = m.duplicate_id
        """
    )

    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                lower(email) AS normalized_email,
                row_number() OVER (
                    PARTITION BY lower(email)
                    ORDER BY created_at ASC, id ASC
                ) AS rn
            FROM users
        )
        DELETE FROM users u
        USING ranked r
        WHERE u.id = r.id
          AND r.rn > 1
        """
    )

    op.drop_index("ix_users_email", table_name="users")
    op.execute("CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email))")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_users_email_lower")
    op.create_index("ix_users_email", "users", ["email"], unique=True)
