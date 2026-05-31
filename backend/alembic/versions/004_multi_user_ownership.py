"""Multi-user ownership — add user_id FK to all user-owned tables.

This migration:
1. Adds user_id columns (nullable initially) to all tables that need ownership
2. Backfills orphaned rows to the first existing user (or creates a default one)
3. Makes columns NOT NULL after backfill
4. Replaces UNIQUE constraints with composite (user_id, date) for multi-tenant safety
5. Adds composite indexes for common query patterns
6. Fully reversible
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '004_multi_user_ownership'
down_revision: Union[str, None] = '003_partial_exit_created_at_datetime'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_first_user_id():
    conn = op.get_bind()
    user = conn.execute(sa.text("SELECT id FROM users ORDER BY id ASC LIMIT 1")).fetchone()
    if user:
        return user[0]
    return None


def _table_exists(conn, table: str) -> bool:
    if conn.dialect.name == "sqlite":
        row = conn.execute(
            sa.text("SELECT 1 FROM sqlite_master WHERE type='table' AND name=:table"),
            {"table": table},
        ).fetchone()
        return row is not None
    row = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = current_schema() AND table_name = :table"
        ),
        {"table": table},
    ).fetchone()
    return row is not None


def _column_exists(conn, table: str, column: str) -> bool:
    if conn.dialect.name == "sqlite":
        rows = conn.execute(sa.text(f"PRAGMA table_info('{table}')")).fetchall()
        return any(row[1] == column for row in rows)
    row = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = current_schema() "
            "AND table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    ).fetchone()
    return row is not None


def _user_ownership_already_present() -> bool:
    conn = op.get_bind()
    required_columns = {
        "trades": "user_id",
        "accounts": "user_id",
        "coach_reviews": "user_id",
        "trade_ideas": "user_id",
        "daily_journals": "user_id",
        "daily_workflows": "user_id",
        "weekly_reviews": "user_id",
        "monthly_reviews": "user_id",
        "market_snapshots": "user_id",
    }
    return all(
        _table_exists(conn, table) and _column_exists(conn, table, column)
        for table, column in required_columns.items()
    )


def _backfill_or_fail(table: str, user_id: int | None):
    conn = op.get_bind()
    result = conn.execute(sa.text(f"SELECT COUNT(*) FROM {table} WHERE user_id IS NULL"))
    count = result.scalar()
    if count == 0:
        return
    if user_id is None:
        # There are data rows but no user to assign them to — this is a bad state.
        # Cli must create a user first and re-run migration.
        raise RuntimeError(
            f"Migration cannot proceed: {table} has {count} orphaned rows but no users exist. "
            "Create a user in the database first, then re-run this migration."
        )
    conn.execute(sa.text(f"UPDATE {table} SET user_id = {user_id} WHERE user_id IS NULL"))


def upgrade() -> None:
    if _user_ownership_already_present():
        return

    first_user_id = _get_first_user_id()

    # ── TRADES ──
    op.add_column('trades', sa.Column('user_id', sa.Integer(), nullable=True))
    _backfill_or_fail('trades', first_user_id)
    op.alter_column('trades', 'user_id', nullable=False)
    op.create_foreign_key('fk_trades_user_id', 'trades', 'users', ['user_id'], ['id'])
    op.create_index('ix_trades_user_id', 'trades', ['user_id'])
    op.create_index('ix_trades_user_status', 'trades', ['user_id', 'status'])
    op.create_index('ix_trades_user_entry_time', 'trades', ['user_id', 'entry_time'])

    # ── ACCOUNTS ──
    op.add_column('accounts', sa.Column('user_id', sa.Integer(), nullable=True))
    _backfill_or_fail('accounts', first_user_id)
    op.alter_column('accounts', 'user_id', nullable=False)
    op.create_foreign_key('fk_accounts_user_id', 'accounts', 'users', ['user_id'], ['id'])
    op.create_index('ix_accounts_user_id', 'accounts', ['user_id'])

    # ── COACH_REVIEWS ──
    op.add_column('coach_reviews', sa.Column('user_id', sa.Integer(), nullable=True))
    _backfill_or_fail('coach_reviews', first_user_id)
    op.alter_column('coach_reviews', 'user_id', nullable=False)
    op.create_foreign_key('fk_coach_reviews_user_id', 'coach_reviews', 'users', ['user_id'], ['id'])
    op.create_index('ix_coach_reviews_user_id', 'coach_reviews', ['user_id'])

    # ── TRADE_IDEAS ──
    op.add_column('trade_ideas', sa.Column('user_id', sa.Integer(), nullable=True))
    _backfill_or_fail('trade_ideas', first_user_id)
    op.alter_column('trade_ideas', 'user_id', nullable=False)
    op.create_foreign_key('fk_trade_ideas_user_id', 'trade_ideas', 'users', ['user_id'], ['id'])
    op.create_index('ix_trade_ideas_user_id', 'trade_ideas', ['user_id'])

    # ── DAILY_JOURNALS — make user_id NOT NULL and add composite unique ──
    _backfill_or_fail('daily_journals', first_user_id)
    try:
        op.alter_column('daily_journals', 'user_id', nullable=False)
    except Exception:
        pass
    try:
        op.drop_constraint('daily_journals_date_key', 'daily_journals', type_='unique')
    except Exception:
        pass
    try:
        op.drop_index('ix_daily_journals_date', table_name='daily_journals')
    except Exception:
        pass
    op.create_unique_constraint(
        'uq_daily_journals_user_date', 'daily_journals', ['user_id', 'date']
    )
    op.create_index('ix_daily_journals_date', 'daily_journals', ['date'])

    # ── DAILY_WORKFLOWS ──
    op.add_column('daily_workflows', sa.Column('user_id', sa.Integer(), nullable=True))
    _backfill_or_fail('daily_workflows', first_user_id)
    op.alter_column('daily_workflows', 'user_id', nullable=False)
    op.create_foreign_key('fk_daily_workflows_user_id', 'daily_workflows', 'users', ['user_id'], ['id'])
    op.create_index('ix_daily_workflows_user_id', 'daily_workflows', ['user_id'])
    try:
        op.drop_constraint('daily_workflows_date_key', 'daily_workflows', type_='unique')
    except Exception:
        pass
    try:
        op.drop_index('ix_daily_workflows_date', table_name='daily_workflows')
    except Exception:
        pass
    op.create_unique_constraint(
        'uq_daily_workflows_user_date', 'daily_workflows', ['user_id', 'date']
    )
    op.create_index('ix_daily_workflows_date', 'daily_workflows', ['date'])

    # ── WEEKLY_REVIEWS ──
    op.add_column('weekly_reviews', sa.Column('user_id', sa.Integer(), nullable=True))
    _backfill_or_fail('weekly_reviews', first_user_id)
    op.alter_column('weekly_reviews', 'user_id', nullable=False)
    op.create_foreign_key('fk_weekly_reviews_user_id', 'weekly_reviews', 'users', ['user_id'], ['id'])
    op.create_index('ix_weekly_reviews_user_id', 'weekly_reviews', ['user_id'])
    try:
        op.drop_constraint('weekly_reviews_week_start_key', 'weekly_reviews', type_='unique')
    except Exception:
        pass
    try:
        op.drop_index('ix_weekly_reviews_week_start', table_name='weekly_reviews')
    except Exception:
        pass
    op.create_unique_constraint(
        'uq_weekly_reviews_user_week', 'weekly_reviews', ['user_id', 'week_start']
    )
    op.create_index('ix_weekly_reviews_week_start', 'weekly_reviews', ['week_start'])

    # ── MONTHLY_REVIEWS ──
    op.add_column('monthly_reviews', sa.Column('user_id', sa.Integer(), nullable=True))
    _backfill_or_fail('monthly_reviews', first_user_id)
    op.alter_column('monthly_reviews', 'user_id', nullable=False)
    op.create_foreign_key('fk_monthly_reviews_user_id', 'monthly_reviews', 'users', ['user_id'], ['id'])
    op.create_index('ix_monthly_reviews_user_id', 'monthly_reviews', ['user_id'])
    try:
        op.drop_constraint('monthly_reviews_month_key', 'monthly_reviews', type_='unique')
    except Exception:
        pass
    try:
        op.drop_index('ix_monthly_reviews_month', table_name='monthly_reviews')
    except Exception:
        pass
    op.create_unique_constraint(
        'uq_monthly_reviews_user_month', 'monthly_reviews', ['user_id', 'month']
    )
    op.create_index('ix_monthly_reviews_month', 'monthly_reviews', ['month'])

    # ── MARKET_SNAPSHOTS ──
    op.add_column('market_snapshots', sa.Column('user_id', sa.Integer(), nullable=True))
    _backfill_or_fail('market_snapshots', first_user_id)
    op.alter_column('market_snapshots', 'user_id', nullable=False)
    op.create_foreign_key('fk_market_snapshots_user_id', 'market_snapshots', 'users', ['user_id'], ['id'])
    op.create_index('ix_market_snapshots_user_id', 'market_snapshots', ['user_id'])
    try:
        op.drop_constraint('market_snapshots_date_key', 'market_snapshots', type_='unique')
    except Exception:
        pass
    try:
        op.drop_index('ix_market_snapshots_date', table_name='market_snapshots')
    except Exception:
        pass
    op.create_unique_constraint(
        'uq_market_snapshots_user_date', 'market_snapshots', ['user_id', 'date']
    )
    op.create_index('ix_market_snapshots_date', 'market_snapshots', ['date'])


def downgrade() -> None:
    # ── TRADES ──
    op.drop_index('ix_trades_user_entry_time', table_name='trades')
    op.drop_index('ix_trades_user_status', table_name='trades')
    op.drop_index('ix_trades_user_id', table_name='trades')
    op.drop_constraint('fk_trades_user_id', 'trades', type_='foreignkey')
    op.drop_column('trades', 'user_id')

    # ── ACCOUNTS ──
    op.drop_index('ix_accounts_user_id', table_name='accounts')
    op.drop_constraint('fk_accounts_user_id', 'accounts', type_='foreignkey')
    op.drop_column('accounts', 'user_id')

    # ── COACH_REVIEWS ──
    op.drop_index('ix_coach_reviews_user_id', table_name='coach_reviews')
    op.drop_constraint('fk_coach_reviews_user_id', 'coach_reviews', type_='foreignkey')
    op.drop_column('coach_reviews', 'user_id')

    # ── TRADE_IDEAS ──
    op.drop_index('ix_trade_ideas_user_id', table_name='trade_ideas')
    op.drop_constraint('fk_trade_ideas_user_id', 'trade_ideas', type_='foreignkey')
    op.drop_column('trade_ideas', 'user_id')

    # ── DAILY_JOURNALS — restore original uniqueness ──
    op.drop_constraint('uq_daily_journals_user_date', 'daily_journals', type_='unique')
    op.drop_index('ix_daily_journals_date', table_name='daily_journals')
    op.create_unique_constraint('daily_journals_date_key', 'daily_journals', ['date'])
    op.create_index('ix_daily_journals_date', 'daily_journals', ['date'])

    # ── DAILY_WORKFLOWS ──
    op.drop_constraint('uq_daily_workflows_user_date', 'daily_workflows', type_='unique')
    op.drop_index('ix_daily_workflows_date', table_name='daily_workflows')
    op.create_unique_constraint('daily_workflows_date_key', 'daily_workflows', ['date'])
    op.create_index('ix_daily_workflows_date', 'daily_workflows', ['date'])
    op.drop_index('ix_daily_workflows_user_id', table_name='daily_workflows')
    op.drop_constraint('fk_daily_workflows_user_id', 'daily_workflows', type_='foreignkey')
    op.drop_column('daily_workflows', 'user_id')

    # ── WEEKLY_REVIEWS ──
    op.drop_constraint('uq_weekly_reviews_user_week', 'weekly_reviews', type_='unique')
    op.drop_index('ix_weekly_reviews_week_start', table_name='weekly_reviews')
    op.create_unique_constraint('weekly_reviews_week_start_key', 'weekly_reviews', ['week_start'])
    op.create_index('ix_weekly_reviews_week_start', 'weekly_reviews', ['week_start'])
    op.drop_index('ix_weekly_reviews_user_id', table_name='weekly_reviews')
    op.drop_constraint('fk_weekly_reviews_user_id', 'weekly_reviews', type_='foreignkey')
    op.drop_column('weekly_reviews', 'user_id')

    # ── MONTHLY_REVIEWS ──
    op.drop_constraint('uq_monthly_reviews_user_month', 'monthly_reviews', type_='unique')
    op.drop_index('ix_monthly_reviews_month', table_name='monthly_reviews')
    op.create_unique_constraint('monthly_reviews_month_key', 'monthly_reviews', ['month'])
    op.create_index('ix_monthly_reviews_month', 'monthly_reviews', ['month'])
    op.drop_index('ix_monthly_reviews_user_id', table_name='monthly_reviews')
    op.drop_constraint('fk_monthly_reviews_user_id', 'monthly_reviews', type_='foreignkey')
    op.drop_column('monthly_reviews', 'user_id')

    # ── MARKET_SNAPSHOTS ──
    op.drop_constraint('uq_market_snapshots_user_date', 'market_snapshots', type_='unique')
    op.drop_index('ix_market_snapshots_date', table_name='market_snapshots')
    op.create_unique_constraint('market_snapshots_date_key', 'market_snapshots', ['date'])
    op.create_index('ix_market_snapshots_date', 'market_snapshots', ['date'])
    op.drop_index('ix_market_snapshots_user_id', table_name='market_snapshots')
    op.drop_constraint('fk_market_snapshots_user_id', 'market_snapshots', type_='foreignkey')
    op.drop_column('market_snapshots', 'user_id')
