"""Initial baseline schema for fresh databases.

Older deployments used SQLAlchemy ``create_all`` before Alembic took over.
Fresh production databases must not rely on that runtime fallback, so this
baseline creates the legacy application tables explicitly. Later migrations
then apply incremental changes to reach the current schema.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial_baseline'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, table: str) -> bool:
    if conn.dialect.name == "sqlite":
        row = conn.execute(
            sa.text("SELECT 1 FROM sqlite_master WHERE type='table' AND name=:table"),
            {"table": table},
        ).fetchone()
        return row is not None
    row = conn.execute(
        sa.text("SELECT 1 FROM information_schema.tables WHERE table_name = :table"),
        {"table": table},
    ).fetchone()
    return row is not None


def _index_exists(conn, table: str, index: str) -> bool:
    if conn.dialect.name == "sqlite":
        rows = conn.execute(sa.text(f"PRAGMA index_list('{table}')")).fetchall()
        return any(row[1] == index for row in rows)
    row = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_indexes "
            "WHERE schemaname = current_schema() AND tablename = :table AND indexname = :index"
        ),
        {"table": table, "index": index},
    ).fetchone()
    return row is not None


def _create_index(conn, name: str, table: str, columns: list[str], unique: bool = False) -> None:
    if not _index_exists(conn, table, name):
        op.create_index(name, table, columns, unique=unique)


def upgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, "users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("full_name", sa.String(), nullable=False),
            sa.Column("hashed_password", sa.String(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index(conn, "ix_users_email", "users", ["email"], unique=True)

    if not _table_exists(conn, "setup_playbook"):
        op.create_table(
            "setup_playbook",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("tactics", sa.JSON(), nullable=True),
            sa.Column("ideal_conditions", sa.JSON(), nullable=True),
            sa.Column("risk_profile", sa.JSON(), nullable=True),
            sa.Column("rules", sa.JSON(), nullable=True),
            sa.Column("win_rate", sa.String(length=20), nullable=True),
            sa.Column("avg_r", sa.String(length=20), nullable=True),
            sa.Column("trade_count", sa.Integer(), nullable=True),
            sa.Column("is_active", sa.String(length=10), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index(conn, "ix_setup_playbook_name", "setup_playbook", ["name"], unique=True)
        _create_index(conn, "ix_setup_playbook_is_active", "setup_playbook", ["is_active"])

    if not _table_exists(conn, "accounts"):
        op.create_table(
            "accounts",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("broker", sa.String(length=100), nullable=True),
            sa.Column("account_number", sa.String(length=50), nullable=True),
            sa.Column("initial_balance", sa.Numeric(precision=18, scale=8), server_default=sa.text("0")),
            sa.Column("current_balance", sa.Numeric(precision=18, scale=8), server_default=sa.text("0")),
            sa.Column("currency", sa.String(length=10), nullable=True),
            sa.Column("breakeven_threshold", sa.Numeric(precision=18, scale=8), server_default=sa.text("500")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index(conn, "ix_accounts_user_id", "accounts", ["user_id"])

    if not _table_exists(conn, "trades"):
        op.create_table(
            "trades",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("symbol", sa.String(length=20), nullable=False),
            sa.Column("direction", sa.String(length=10), nullable=False),
            sa.Column("entry_price", sa.Numeric(precision=18, scale=8), nullable=False),
            sa.Column("exit_price", sa.Numeric(precision=18, scale=8), nullable=True),
            sa.Column("quantity", sa.Numeric(precision=18, scale=8), nullable=False),
            sa.Column("entry_time", sa.DateTime(), nullable=False),
            sa.Column("exit_time", sa.DateTime(), nullable=True),
            sa.Column("fees", sa.Numeric(precision=18, scale=8), nullable=True),
            sa.Column("pnl", sa.Numeric(precision=18, scale=8), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("tags", sa.JSON(), nullable=True),
            sa.Column("setup", sa.String(length=100), nullable=True),
            sa.Column("tactic", sa.String(length=100), nullable=True),
            sa.Column("stop_price", sa.Numeric(precision=18, scale=8), nullable=True),
            sa.Column("target_price", sa.Numeric(precision=18, scale=8), nullable=True),
            sa.Column("r_multiple", sa.Numeric(precision=10, scale=4), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=True),
            sa.Column("review_notes", sa.Text(), nullable=True),
            sa.Column("review_tags", sa.JSON(), nullable=True),
            sa.Column("chart_images", sa.JSON(), nullable=True),
            sa.Column("exit_reason", sa.String(length=20), nullable=True),
            sa.Column("exit_notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index(conn, "ix_trades_user_id", "trades", ["user_id"])
        _create_index(conn, "ix_trades_symbol", "trades", ["symbol"])
        _create_index(conn, "ix_trades_entry_time", "trades", ["entry_time"])
        _create_index(conn, "ix_trades_user_status", "trades", ["user_id", "status"])
        _create_index(conn, "ix_trades_user_entry_time", "trades", ["user_id", "entry_time"])

    if not _table_exists(conn, "trade_ideas"):
        op.create_table(
            "trade_ideas",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("symbol", sa.String(length=20), nullable=False),
            sa.Column("direction", sa.String(length=10), nullable=False),
            sa.Column("entry_price_target", sa.Numeric(precision=18, scale=8), nullable=True),
            sa.Column("stop_price", sa.Numeric(precision=18, scale=8), nullable=True),
            sa.Column("target_price", sa.Numeric(precision=18, scale=8), nullable=True),
            sa.Column("thesis", sa.Text(), nullable=True),
            sa.Column("timeframe", sa.String(length=50), nullable=True),
            sa.Column("confidence", sa.String(length=20), nullable=True),
            sa.Column("tags", sa.String(length=200), nullable=True),
            sa.Column("revisit_date", sa.DateTime(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("traded_trade_id", sa.Integer(), nullable=True),
            sa.Column("triggered_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["traded_trade_id"], ["trades.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index(conn, "ix_trade_ideas_user_id", "trade_ideas", ["user_id"])
        _create_index(conn, "ix_trade_ideas_status", "trade_ideas", ["status"])
        _create_index(conn, "ix_trade_ideas_symbol", "trade_ideas", ["symbol"])

    if not _table_exists(conn, "capital_events"):
        op.create_table(
            "capital_events",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("event_type", sa.String(length=50), nullable=False),
            sa.Column("amount", sa.Numeric(precision=18, scale=8), nullable=False),
            sa.Column("timestamp", sa.DateTime(), nullable=False),
            sa.Column("description", sa.String(length=200), nullable=True),
            sa.Column("trade_id", sa.Integer(), nullable=True),
            sa.Column("account_id", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
            sa.ForeignKeyConstraint(["trade_id"], ["trades.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index(conn, "ix_capital_events_timestamp", "capital_events", ["timestamp"])
        _create_index(conn, "ix_capital_events_account_type_time", "capital_events", ["account_id", "event_type", "timestamp"])

    if not _table_exists(conn, "stop_history"):
        op.create_table(
            "stop_history",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("trade_id", sa.Integer(), nullable=False),
            sa.Column("stop_type", sa.String(length=20), nullable=False),
            sa.Column("price", sa.Numeric(precision=18, scale=8), nullable=False),
            sa.Column("timestamp", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["trade_id"], ["trades.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index(conn, "ix_stop_history_trade_id", "stop_history", ["trade_id"])

    if not _table_exists(conn, "trade_timeline"):
        op.create_table(
            "trade_timeline",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("trade_id", sa.Integer(), nullable=False),
            sa.Column("event_type", sa.String(length=30), nullable=False),
            sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("old_value", sa.String(length=200), nullable=True),
            sa.Column("new_value", sa.String(length=200), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("emotion", sa.String(length=30), nullable=True),
            sa.Column("confidence", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["trade_id"], ["trades.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index(conn, "ix_trade_timeline_trade_id", "trade_timeline", ["trade_id"])
        _create_index(conn, "ix_trade_timeline_event_type", "trade_timeline", ["event_type"])
        _create_index(conn, "ix_timeline_trade_event", "trade_timeline", ["trade_id", "event_type"])

    if not _table_exists(conn, "partial_exits"):
        op.create_table(
            "partial_exits",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("trade_id", sa.Integer(), nullable=False),
            sa.Column("qty", sa.Numeric(precision=18, scale=8), nullable=False),
            sa.Column("exit_price", sa.Numeric(precision=18, scale=8), nullable=False),
            sa.Column("exit_time", sa.DateTime(), nullable=False),
            sa.Column("realized_pnl", sa.Numeric(precision=18, scale=8), nullable=True),
            sa.Column("r_captured", sa.Numeric(precision=10, scale=4), nullable=True),
            sa.Column("exit_reason", sa.String(length=30), nullable=True),
            sa.Column("note", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["trade_id"], ["trades.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index(conn, "ix_partial_exits_trade_id", "partial_exits", ["trade_id"])
        _create_index(conn, "ix_partial_exits_trade_exit_time", "partial_exits", ["trade_id", "exit_time"])

    if not _table_exists(conn, "emotion_logs"):
        op.create_table(
            "emotion_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("trade_id", sa.Integer(), nullable=False),
            sa.Column("emotion", sa.String(length=30), nullable=False),
            sa.Column("confidence", sa.Integer(), nullable=True),
            sa.Column("stress", sa.Integer(), nullable=True),
            sa.Column("conviction", sa.Integer(), nullable=True),
            sa.Column("patience", sa.Integer(), nullable=True),
            sa.Column("focus", sa.Integer(), nullable=True),
            sa.Column("note", sa.String(length=500), nullable=True),
            sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["trade_id"], ["trades.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index(conn, "ix_emotion_logs_trade_id", "emotion_logs", ["trade_id"])
        _create_index(conn, "ix_emotion_logs_trade_timestamp", "emotion_logs", ["trade_id", "timestamp"])
        _create_index(conn, "ix_emotion_logs_emotion", "emotion_logs", ["emotion"])

    if not _table_exists(conn, "execution_grades"):
        op.create_table(
            "execution_grades",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("trade_id", sa.Integer(), nullable=False),
            sa.Column("entry_quality", sa.String(length=1), nullable=True),
            sa.Column("sizing_quality", sa.String(length=1), nullable=True),
            sa.Column("stop_quality", sa.String(length=1), nullable=True),
            sa.Column("patience", sa.String(length=1), nullable=True),
            sa.Column("rule_adherence", sa.String(length=1), nullable=True),
            sa.Column("exit_quality", sa.String(length=1), nullable=True),
            sa.Column("overall_grade", sa.String(length=1), nullable=True),
            sa.Column("notes", sa.String(length=1000), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["trade_id"], ["trades.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("trade_id"),
        )
        _create_index(conn, "ix_execution_grades_overall_grade", "execution_grades", ["overall_grade"])

    if not _table_exists(conn, "daily_journals"):
        op.create_table(
            "daily_journals",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("pre_trade_notes", sa.Text(), nullable=True),
            sa.Column("post_trade_notes", sa.Text(), nullable=True),
            sa.Column("trade_count", sa.Integer(), nullable=True),
            sa.Column("total_pnl", sa.Numeric(precision=18, scale=8), nullable=True),
            sa.Column("avg_r_multiple", sa.Numeric(precision=10, scale=4), nullable=True),
            sa.Column("win_rate", sa.Numeric(precision=6, scale=4), nullable=True),
            sa.Column("mood_rating", sa.Integer(), nullable=True),
            sa.Column("discipline_rating", sa.Integer(), nullable=True),
            sa.Column("mood_notes", sa.Text(), nullable=True),
            sa.Column("rules_followed", sa.String(length=500), nullable=True),
            sa.Column("rules_violated", sa.String(length=500), nullable=True),
            sa.Column("lessons_learned", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.CheckConstraint("mood_rating IS NULL OR (mood_rating >= 1 AND mood_rating <= 5)", name="ck_daily_journals_mood_rating"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "date", name="uq_daily_journals_user_date"),
        )
        _create_index(conn, "ix_daily_journals_date", "daily_journals", ["date"])
        _create_index(conn, "ix_daily_journals_user_id", "daily_journals", ["user_id"])

    if not _table_exists(conn, "coach_reviews"):
        op.create_table(
            "coach_reviews",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("review_type", sa.String(length=50), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
            sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
            sa.Column("trade_ids", sa.JSON(), nullable=True),
            sa.Column("summary_stats", sa.JSON(), nullable=True),
            sa.Column("detected_patterns", sa.JSON(), nullable=True),
            sa.Column("model_used", sa.String(length=100), nullable=True),
            sa.Column("prompt_template", sa.String(length=100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index(conn, "ix_coach_reviews_user_id", "coach_reviews", ["user_id"])
        _create_index(conn, "ix_coach_reviews_type_created", "coach_reviews", ["review_type", "created_at"])
        _create_index(conn, "ix_coach_reviews_period", "coach_reviews", ["period_start", "period_end"])

    if not _table_exists(conn, "tier_configs"):
        op.create_table(
            "tier_configs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=50), nullable=False),
            sa.Column("min_amount", sa.Numeric(precision=18, scale=8), nullable=False),
            sa.Column("max_amount", sa.Numeric(precision=18, scale=8), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _table_exists(conn, "milestones"):
        op.create_table(
            "milestones",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("target_date", sa.Date(), nullable=False),
            sa.Column("target_amount", sa.Numeric(precision=18, scale=8), nullable=True),
            sa.Column("achieved", sa.Boolean(), nullable=True),
            sa.Column("achieved_date", sa.Date(), nullable=True),
            sa.Column("notes", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _table_exists(conn, "live_quotes"):
        op.create_table(
            "live_quotes",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("symbol", sa.String(length=50), nullable=False),
            sa.Column("company_name", sa.String(length=200), nullable=True),
            sa.Column("ltp", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("change", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("change_pct", sa.Numeric(precision=10, scale=4), nullable=True),
            sa.Column("volume", sa.Numeric(precision=18, scale=2), nullable=True),
            sa.Column("high_52w", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("low_52w", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("pe", sa.Numeric(precision=10, scale=4), nullable=True),
            sa.Column("market_cap_cr", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("sector", sa.String(length=100), nullable=True),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
        )
        _create_index(conn, "ix_live_quotes_symbol", "live_quotes", ["symbol"], unique=True)

    if not _table_exists(conn, "market_snapshots"):
        op.create_table(
            "market_snapshots",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("nifty_close", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("nifty_change_pct", sa.Numeric(precision=10, scale=4), nullable=True),
            sa.Column("nifty_high", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("nifty_low", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("nifty_open", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("nifty_trend", sa.String(length=20), nullable=True),
            sa.Column("nifty_regime", sa.String(length=20), nullable=True),
            sa.Column("india_vix", sa.Numeric(precision=10, scale=4), nullable=True),
            sa.Column("atr_14", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("atr_pct", sa.Numeric(precision=10, scale=4), nullable=True),
            sa.Column("advance_count", sa.Integer(), nullable=True),
            sa.Column("decline_count", sa.Integer(), nullable=True),
            sa.Column("advance_decline_ratio", sa.Numeric(precision=10, scale=4), nullable=True),
            sa.Column("sector_strength", sa.JSON(), nullable=True),
            sa.Column("fii_flow_cr", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("dii_flow_cr", sa.Numeric(precision=18, scale=4), nullable=True),
            sa.Column("is_earnings_season", sa.String(length=10), nullable=True),
            sa.Column("macro_events", sa.JSON(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "date", name="uq_market_snapshots_user_date"),
        )
        _create_index(conn, "ix_market_snapshots_user_id", "market_snapshots", ["user_id"])
        _create_index(conn, "ix_market_snapshots_date", "market_snapshots", ["date"])

    if not _table_exists(conn, "daily_workflows"):
        op.create_table(
            "daily_workflows",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("phase", sa.String(length=20), nullable=False),
            sa.Column("pre_market_done", sa.Boolean(), nullable=True),
            sa.Column("execution_done", sa.Boolean(), nullable=True),
            sa.Column("review_done", sa.Boolean(), nullable=True),
            sa.Column("behavior_done", sa.Boolean(), nullable=True),
            sa.Column("checklist_items", sa.JSON(), nullable=True),
            sa.Column("watchlist_symbols", sa.JSON(), nullable=True),
            sa.Column("pre_market_notes", sa.Text(), nullable=True),
            sa.Column("intraday_notes", sa.Text(), nullable=True),
            sa.Column("post_market_notes", sa.Text(), nullable=True),
            sa.Column("mood_rating", sa.Integer(), nullable=True),
            sa.Column("discipline_rating", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "date", name="uq_daily_workflows_user_date"),
        )
        _create_index(conn, "ix_daily_workflows_user_id", "daily_workflows", ["user_id"])
        _create_index(conn, "ix_daily_workflows_date", "daily_workflows", ["date"])

    if not _table_exists(conn, "weekly_reviews"):
        op.create_table(
            "weekly_reviews",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("week_start", sa.Date(), nullable=False),
            sa.Column("week_end", sa.Date(), nullable=False),
            sa.Column("total_trades", sa.Integer(), nullable=True),
            sa.Column("total_pnl", sa.String(), nullable=True),
            sa.Column("win_rate", sa.String(), nullable=True),
            sa.Column("best_trade_id", sa.Integer(), nullable=True),
            sa.Column("worst_trade_id", sa.Integer(), nullable=True),
            sa.Column("top_setup", sa.String(), nullable=True),
            sa.Column("rules_followed", sa.Integer(), nullable=True),
            sa.Column("rules_violated", sa.Integer(), nullable=True),
            sa.Column("key_lessons", sa.Text(), nullable=True),
            sa.Column("discipline_score", sa.String(), nullable=True),
            sa.Column("emotion_summary", sa.JSON(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("completed", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "week_start", name="uq_weekly_reviews_user_week"),
        )
        _create_index(conn, "ix_weekly_reviews_user_id", "weekly_reviews", ["user_id"])
        _create_index(conn, "ix_weekly_reviews_week_start", "weekly_reviews", ["week_start"])

    if not _table_exists(conn, "monthly_reviews"):
        op.create_table(
            "monthly_reviews",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("month", sa.String(length=7), nullable=False),
            sa.Column("total_trades", sa.Integer(), nullable=True),
            sa.Column("total_pnl", sa.String(), nullable=True),
            sa.Column("win_rate", sa.String(), nullable=True),
            sa.Column("profit_factor", sa.String(), nullable=True),
            sa.Column("avg_r", sa.String(), nullable=True),
            sa.Column("best_setup", sa.String(), nullable=True),
            sa.Column("worst_setup", sa.String(), nullable=True),
            sa.Column("best_day", sa.String(), nullable=True),
            sa.Column("worst_day", sa.String(), nullable=True),
            sa.Column("discipline_avg", sa.String(), nullable=True),
            sa.Column("behavioral_patterns", sa.JSON(), nullable=True),
            sa.Column("rule_compliance_rate", sa.String(), nullable=True),
            sa.Column("capital_growth_pct", sa.String(), nullable=True),
            sa.Column("goals_met", sa.JSON(), nullable=True),
            sa.Column("next_month_goals", sa.JSON(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("completed", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "month", name="uq_monthly_reviews_user_month"),
        )
        _create_index(conn, "ix_monthly_reviews_user_id", "monthly_reviews", ["user_id"])
        _create_index(conn, "ix_monthly_reviews_month", "monthly_reviews", ["month"])


def downgrade() -> None:
    conn = op.get_bind()
    for table in (
        "monthly_reviews",
        "weekly_reviews",
        "daily_workflows",
        "market_snapshots",
        "live_quotes",
        "milestones",
        "tier_configs",
        "coach_reviews",
        "daily_journals",
        "execution_grades",
        "emotion_logs",
        "partial_exits",
        "trade_timeline",
        "stop_history",
        "capital_events",
        "trade_ideas",
        "trades",
        "accounts",
        "setup_playbook",
        "users",
    ):
        if _table_exists(conn, table):
            op.drop_table(table)
