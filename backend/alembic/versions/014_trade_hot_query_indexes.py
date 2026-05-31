"""Add hot-path trade indexes.

Revision ID: 014_trade_hot_query_indexes
Revises: 013_ai_provider_settings
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "014_trade_hot_query_indexes"
down_revision: Union[str, None] = "013_ai_provider_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEXES = (
    ("ix_trades_user_active_entry_time", ["user_id", "entry_time"]),
    ("ix_trades_user_active_exit_entry", ["user_id", "exit_price", "entry_time"]),
)


def _index_exists(conn, index_name: str) -> bool:
    if conn.dialect.name == "sqlite":
        rows = conn.execute(sa.text("PRAGMA index_list('trades')")).fetchall()
        return any(row[1] == index_name for row in rows)

    if conn.dialect.name == "postgresql":
        row = conn.execute(
            sa.text(
                "SELECT 1 FROM pg_indexes "
                "WHERE schemaname = current_schema() "
                "AND tablename = 'trades' "
                "AND indexname = :index_name"
            ),
            {"index_name": index_name},
        ).fetchone()
        return row is not None

    inspector = sa.inspect(conn)
    return any(index["name"] == index_name for index in inspector.get_indexes("trades"))


def _create_active_trade_index(conn, index_name: str, columns: list[str]) -> None:
    if _index_exists(conn, index_name):
        return

    kwargs = {}
    if conn.dialect.name == "postgresql":
        kwargs["postgresql_where"] = sa.text("status <> 'deleted'")
    elif conn.dialect.name == "sqlite":
        kwargs["sqlite_where"] = sa.text("status != 'deleted'")

    op.create_index(index_name, "trades", columns, unique=False, **kwargs)


def upgrade() -> None:
    conn = op.get_bind()
    for index_name, columns in INDEXES:
        _create_active_trade_index(conn, index_name, columns)


def downgrade() -> None:
    conn = op.get_bind()
    for index_name, _columns in reversed(INDEXES):
        if _index_exists(conn, index_name):
            op.drop_index(index_name, table_name="trades")
