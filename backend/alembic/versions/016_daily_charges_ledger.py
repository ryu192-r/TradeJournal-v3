"""Daily charges ledger foundation.

Revision ID: 016_daily_charges_ledger
Revises: 015_trade_ideas_user_id_repair
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "016_daily_charges_ledger"
down_revision: Union[str, None] = "015_trade_ideas_user_id_repair"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "daily_charges",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("broker", sa.String(length=100), nullable=True),
        sa.Column("account_ref", sa.String(length=100), nullable=True),
        sa.Column("contract_note_ref", sa.String(length=100), nullable=True),
        sa.Column("brokerage", sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column("stt", sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column("exchange_txn_charges", sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column("sebi_charges", sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column("stamp_duty", sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column("gst", sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column("clearing_charges", sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column("other_charges", sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column("total_charges", sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "trade_date", name="uq_daily_charges_user_date"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index(op.f("ix_daily_charges_user_id"), "daily_charges", ["user_id"], unique=False)
    op.create_index(op.f("ix_daily_charges_trade_date"), "daily_charges", ["trade_date"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_daily_charges_trade_date"), table_name="daily_charges")
    op.drop_index(op.f("ix_daily_charges_user_id"), table_name="daily_charges")
    op.drop_table("daily_charges")
