"""drop dead V3-migration tables: trade_ideas, weekly_reviews, monthly_reviews

Issue #67 (scope C). The V3 migration stopped all reads/writes to these three
tables. This drops them. `daily_workflows` and `daily_journal.discipline_rating`
are intentionally NOT dropped here (still read by calendar/reports/edge) — they
remain deferred.

DESTRUCTIVE: row data is not recoverable via downgrade(). A full pg_dump and a
targeted data-only dump were taken before applying (see backups/, gitignored).
downgrade() restores table STRUCTURE only (empty tables).

Revision ID: f1a2b3c4d5e6
Revises: c3a9d5f1b001
Create Date: 2026-06-14
"""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "c3a9d5f1b001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop order is unconstrained — no other table holds an FK into these three.
    op.drop_table("trade_ideas")
    op.drop_table("weekly_reviews")
    op.drop_table("monthly_reviews")


def downgrade() -> None:
    # Schema-only restoration (no data). Mirrors the original table definitions.

    op.create_table(
        "monthly_reviews",
        sa.Column("id", sa.Integer(), nullable=False),
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
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_monthly_reviews_user_id"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "month", name="uq_monthly_reviews_user_month"),
    )
    op.create_index("ix_monthly_reviews_id", "monthly_reviews", ["id"])
    op.create_index("ix_monthly_reviews_month", "monthly_reviews", ["month"])
    op.create_index("ix_monthly_reviews_user_id", "monthly_reviews", ["user_id"])

    op.create_table(
        "weekly_reviews",
        sa.Column("id", sa.Integer(), nullable=False),
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
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_weekly_reviews_user_id"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "week_start", name="uq_weekly_reviews_user_week"),
    )
    op.create_index("ix_weekly_reviews_id", "weekly_reviews", ["id"])
    op.create_index("ix_weekly_reviews_user_id", "weekly_reviews", ["user_id"])
    op.create_index("ix_weekly_reviews_week_start", "weekly_reviews", ["week_start"])

    op.create_table(
        "trade_ideas",
        sa.Column("id", sa.Integer(), nullable=False),
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
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_trade_ideas_user_id"),
        sa.ForeignKeyConstraint(["traded_trade_id"], ["trades.id"], name="trade_ideas_traded_trade_id_fkey"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trade_ideas_id", "trade_ideas", ["id"])
    op.create_index("ix_trade_ideas_status", "trade_ideas", ["status"])
    op.create_index("ix_trade_ideas_symbol", "trade_ideas", ["symbol"])
    op.create_index("ix_trade_ideas_user_id", "trade_ideas", ["user_id"])
