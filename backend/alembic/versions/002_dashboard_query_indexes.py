"""Add indexes for dashboard and analytics query paths."""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect


revision: str = "002_dashboard_query_indexes"
down_revision: Union[str, None] = "001_initial_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _index_exists(table_name: str, index_name: str) -> bool:
    """Check whether an index already exists on a table."""
    bind = op.get_bind()
    indexes = inspect(bind).get_indexes(table_name)
    return any(idx["name"] == index_name for idx in indexes)


def upgrade() -> None:
    tables = set(inspect(op.get_bind()).get_table_names())

    if "trades" in tables:
        if not _index_exists("trades", "ix_trades_status_exit_entry"):
            op.create_index("ix_trades_status_exit_entry", "trades", ["status", "exit_price", "entry_time"])
        if not _index_exists("trades", "ix_trades_setup_status"):
            op.create_index("ix_trades_setup_status", "trades", ["setup", "status"])

    if "partial_exits" in tables:
        if not _index_exists("partial_exits", "ix_partial_exits_trade_exit_time"):
            op.create_index("ix_partial_exits_trade_exit_time", "partial_exits", ["trade_id", "exit_time"])

    if "emotion_logs" in tables:
        if not _index_exists("emotion_logs", "ix_emotion_logs_trade_timestamp"):
            op.create_index("ix_emotion_logs_trade_timestamp", "emotion_logs", ["trade_id", "timestamp"])
        if not _index_exists("emotion_logs", "ix_emotion_logs_emotion"):
            op.create_index("ix_emotion_logs_emotion", "emotion_logs", ["emotion"])

    if "execution_grades" in tables:
        if not _index_exists("execution_grades", "ix_execution_grades_overall_grade"):
            op.create_index("ix_execution_grades_overall_grade", "execution_grades", ["overall_grade"])

    if "capital_events" in tables:
        if not _index_exists("capital_events", "ix_capital_events_account_type_time"):
            op.create_index(
                "ix_capital_events_account_type_time",
                "capital_events",
                ["account_id", "event_type", "timestamp"],
            )


def downgrade() -> None:
    tables = set(inspect(op.get_bind()).get_table_names())

    if "capital_events" in tables and _index_exists("capital_events", "ix_capital_events_account_type_time"):
        op.drop_index("ix_capital_events_account_type_time", table_name="capital_events")

    if "execution_grades" in tables and _index_exists("execution_grades", "ix_execution_grades_overall_grade"):
        op.drop_index("ix_execution_grades_overall_grade", table_name="execution_grades")

    if "emotion_logs" in tables:
        if _index_exists("emotion_logs", "ix_emotion_logs_emotion"):
            op.drop_index("ix_emotion_logs_emotion", table_name="emotion_logs")
        if _index_exists("emotion_logs", "ix_emotion_logs_trade_timestamp"):
            op.drop_index("ix_emotion_logs_trade_timestamp", table_name="emotion_logs")

    if "partial_exits" in tables and _index_exists("partial_exits", "ix_partial_exits_trade_exit_time"):
        op.drop_index("ix_partial_exits_trade_exit_time", table_name="partial_exits")

    if "trades" in tables:
        if _index_exists("trades", "ix_trades_setup_status"):
            op.drop_index("ix_trades_setup_status", table_name="trades")
        if _index_exists("trades", "ix_trades_status_exit_entry"):
            op.drop_index("ix_trades_status_exit_entry", table_name="trades")
