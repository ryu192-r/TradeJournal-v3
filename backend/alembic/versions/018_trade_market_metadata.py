"""Add market metadata to trades (exchange, segment, product_type, executed_order_count).

Revision ID: 018_trade_market_metadata
Revises: 017_daily_charges_entry_mode
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "018_trade_market_metadata"
down_revision: Union[str, None] = "017_daily_charges_entry_mode"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("trades", sa.Column("exchange", sa.String(20), nullable=False, server_default="UNKNOWN"))
    op.add_column("trades", sa.Column("segment", sa.String(30), nullable=False, server_default="UNKNOWN"))
    op.add_column("trades", sa.Column("product_type", sa.String(30), nullable=False, server_default="UNKNOWN"))
    op.add_column("trades", sa.Column("executed_order_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("trades", "executed_order_count")
    op.drop_column("trades", "product_type")
    op.drop_column("trades", "segment")
    op.drop_column("trades", "exchange")
