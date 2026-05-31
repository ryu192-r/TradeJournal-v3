"""Split planned stop loss from current stop loss.

Revision ID: 012_trade_original_current_stop_split
Revises: 011_performance_os_user_ownership
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "012_trade_original_current_stop_split"
down_revision: Union[str, None] = "011_performance_os_user_ownership"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    if conn.dialect.name == "sqlite":
        rows = conn.execute(sa.text(f"PRAGMA table_info({table})")).fetchall()
        return any(row[1] == column for row in rows)
    row = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    ).fetchone()
    return row is not None


def upgrade() -> None:
    conn = op.get_bind()

    with op.batch_alter_table("trades") as batch_op:
        if not _column_exists(conn, "trades", "original_stop_price"):
            batch_op.add_column(sa.Column("original_stop_price", sa.Numeric(precision=18, scale=8), nullable=True))
        if not _column_exists(conn, "trades", "stop_loss_status"):
            batch_op.add_column(sa.Column("stop_loss_status", sa.String(length=20), nullable=True))

    # Backfill legacy rows: original stop = old stop; default status = original.
    conn.execute(
        sa.text(
            "UPDATE trades "
            "SET original_stop_price = stop_price "
            "WHERE original_stop_price IS NULL AND stop_price IS NOT NULL"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE trades "
            "SET stop_loss_status = 'original' "
            "WHERE stop_loss_status IS NULL AND stop_price IS NOT NULL"
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    with op.batch_alter_table("trades") as batch_op:
        if _column_exists(conn, "trades", "stop_loss_status"):
            batch_op.drop_column("stop_loss_status")
        if _column_exists(conn, "trades", "original_stop_price"):
            batch_op.drop_column("original_stop_price")
