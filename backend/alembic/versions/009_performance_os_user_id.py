"""Revision anchor for deployed DBs already stamped at 009.

The original 009 added user_id to performance OS tables on servers that ran
create_all after migration 004. Logic is superseded by 011 (safer backfill),
but this revision must remain in the graph for alembic_version rows at 009.
"""

from typing import Sequence, Union


revision: str = "009_performance_os_user_id"
down_revision: Union[str, None] = "008_market_candles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
