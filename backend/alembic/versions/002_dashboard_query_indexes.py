"""Add indexes for dashboard and analytics query paths."""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect


revision: str = "002_dashboard_query_indexes"
down_revision: Union[str, None] = "001_initial_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = set(inspect(op.get_bind()).get_table_names())
    if "trades" in tables:
        op.create_index("ix_trades_status_exit_entry", "trades", ["status", "exit_price", "entry_time"])
        op.create_index("ix_trades_setup_status", "trades", ["setup", "status"])
    if "partial_exits" in tables:
        op.create_index("ix_partial_exits_trade_exit_time", "partial_exits", ["trade_id", "exit_time"])
    if "emotion_logs" in tables:
        op.create_index("ix_emotion_logs_trade_timestamp", "emotion_logs", ["trade_id", "timestamp"])
        op.create_index("ix_emotion_logs_emotion", "emotion_logs", ["emotion"])
    if "execution_grades" in tables:
        op.create_index("ix_execution_grades_overall_grade", "execution_grades", ["overall_grade"])
    if "capital_events" in tables:
        op.create_index(
            "ix_capital_events_account_type_time",
            "capital_events",
            ["account_id", "event_type", "timestamp"],
        )


def downgrade() -> None:
    tables = set(inspect(op.get_bind()).get_table_names())
    if "capital_events" in tables:
        op.drop_index("ix_capital_events_account_type_time", table_name="capital_events")
    if "execution_grades" in tables:
        op.drop_index("ix_execution_grades_overall_grade", table_name="execution_grades")
    if "emotion_logs" in tables:
        op.drop_index("ix_emotion_logs_emotion", table_name="emotion_logs")
        op.drop_index("ix_emotion_logs_trade_timestamp", table_name="emotion_logs")
    if "partial_exits" in tables:
        op.drop_index("ix_partial_exits_trade_exit_time", table_name="partial_exits")
    if "trades" in tables:
        op.drop_index("ix_trades_setup_status", table_name="trades")
        op.drop_index("ix_trades_status_exit_entry", table_name="trades")
