"""add bias_notes to daily_journals

The bias_notes column was added to the DailyJournal model/schema in Phase 4
(journal merge) but no migration shipped. Postgres deployments running Alembic
never got the column, so every DailyJournal query (calendar, journal) 500s with
`column daily_journals.bias_notes does not exist`. This backfills the column.

Revision ID: a8f3c1d2e002
Revises: a8f3c1d2e001
Create Date: 2026-06-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8f3c1d2e002"
down_revision: Union[str, None] = "a8f3c1d2e001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("daily_journals") as batch_op:
        batch_op.add_column(sa.Column("bias_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("daily_journals") as batch_op:
        batch_op.drop_column("bias_notes")
