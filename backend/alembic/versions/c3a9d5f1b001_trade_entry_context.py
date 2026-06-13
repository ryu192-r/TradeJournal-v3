"""add entry_context to trades

Revision ID: c3a9d5f1b001
Revises: b1e4f7a9c012
Create Date: 2026-06-13
"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "c3a9d5f1b001"
down_revision: Union[str, None] = "b1e4f7a9c012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trades", sa.Column("entry_context", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("trades", "entry_context")
