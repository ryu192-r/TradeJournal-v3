"""Add entry_mode to daily_charges ledger.

Revision ID: 017_daily_charges_entry_mode
Revises: 016_daily_charges_ledger
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "017_daily_charges_entry_mode"
down_revision: Union[str, None] = "016_daily_charges_ledger"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "daily_charges",
        sa.Column("entry_mode", sa.String(length=20), nullable=True),
    )
    op.execute("UPDATE daily_charges SET entry_mode = 'breakdown'")
    op.alter_column("daily_charges", "entry_mode", nullable=False)


def downgrade() -> None:
    op.drop_column("daily_charges", "entry_mode")
