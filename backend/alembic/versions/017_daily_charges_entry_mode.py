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
    with op.batch_alter_table("daily_charges") as batch_op:
        batch_op.add_column(sa.Column("entry_mode", sa.String(length=20), nullable=True))
    op.execute("UPDATE daily_charges SET entry_mode = 'breakdown'")
    with op.batch_alter_table("daily_charges") as batch_op:
        batch_op.alter_column("entry_mode", nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("daily_charges") as batch_op:
        batch_op.drop_column("entry_mode")
