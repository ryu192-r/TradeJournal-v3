"""Repair trade_ideas user_id ownership.

Revision ID: 015_trade_ideas_user_id_repair
Revises: 014_trade_hot_query_indexes
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "015_trade_ideas_user_id_repair"
down_revision: Union[str, None] = "014_trade_hot_query_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # If orphan rows exist, assign them to the first available user.
    # Safe no-op if all rows already have user_id populated.
    # Uses correlated subquery instead of PostgreSQL-specific UPDATE...FROM
    # so the migration works on both PostgreSQL (production) and SQLite (tests).
    conn.execute(
        sa.text(
            """
            UPDATE trade_ideas
            SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1)
            WHERE user_id IS NULL
            """
        )
    )


def downgrade() -> None:
    # No automatic downgrade for ownership repair.
    pass
