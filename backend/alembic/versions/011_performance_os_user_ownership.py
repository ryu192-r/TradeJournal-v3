"""Performance OS user ownership — idempotent user_id + composite uniques.

Revision ID: 011_performance_os_user_ownership
Revises: 009_performance_os_user_id

Handles DBs where performance OS tables were created after migration 004
(create_all path) and lack user_id / user-scoped uniqueness.

Backfill policy:
- exactly 1 user  -> assign orphan rows to that user
- 0 users, empty table -> safe no-op
- 0 users, rows exist -> RuntimeError
- 2+ users, orphan rows -> RuntimeError (never assign to first user)
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "011_performance_os_user_ownership"
down_revision: Union[str, None] = "009_performance_os_user_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE_SPECS = (
    {
        "table": "daily_workflows",
        "old_unique_names": (
            "daily_workflows_date_key",
            "ix_daily_workflows_date",
        ),
        "new_unique": "uq_daily_workflows_user_date",
        "unique_columns": ("user_id", "date"),
        "date_index": "ix_daily_workflows_date",
        "date_column": "date",
    },
    {
        "table": "weekly_reviews",
        "old_unique_names": (
            "weekly_reviews_week_start_key",
            "ix_weekly_reviews_week_start",
        ),
        "new_unique": "uq_weekly_reviews_user_week",
        "unique_columns": ("user_id", "week_start"),
        "date_index": "ix_weekly_reviews_week_start",
        "date_column": "week_start",
    },
    {
        "table": "monthly_reviews",
        "old_unique_names": (
            "monthly_reviews_month_key",
            "ix_monthly_reviews_month",
        ),
        "new_unique": "uq_monthly_reviews_user_month",
        "unique_columns": ("user_id", "month"),
        "date_index": "ix_monthly_reviews_month",
        "date_column": "month",
    },
)


def _dialect(conn) -> str:
    return conn.dialect.name


def table_exists(conn, table: str) -> bool:
    if _dialect(conn) == "sqlite":
        row = conn.execute(
            sa.text("SELECT 1 FROM sqlite_master WHERE type='table' AND name=:name"),
            {"name": table},
        ).fetchone()
        return row is not None
    row = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables WHERE table_name = :name"
        ),
        {"name": table},
    ).fetchone()
    return row is not None


def column_exists(conn, table: str, column: str) -> bool:
    if _dialect(conn) == "sqlite":
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


def index_exists(conn, table: str, name: str) -> bool:
    if _dialect(conn) == "sqlite":
        rows = conn.execute(sa.text(f"PRAGMA index_list('{table}')")).fetchall()
        return any(row[1] == name for row in rows)
    row = conn.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE indexname = :name"),
        {"name": name},
    ).fetchone()
    return row is not None


def constraint_exists(conn, name: str) -> bool:
    if _dialect(conn) == "sqlite":
        return False
    row = conn.execute(
        sa.text("SELECT 1 FROM pg_constraint WHERE conname = :name"),
        {"name": name},
    ).fetchone()
    return row is not None


def count_users(conn) -> int:
    if not table_exists(conn, "users"):
        return 0
    return conn.execute(sa.text("SELECT COUNT(*) FROM users")).scalar() or 0


def count_rows(conn, table: str) -> int:
    return conn.execute(sa.text(f"SELECT COUNT(*) FROM {table}")).scalar() or 0


def count_null_user_id_rows(conn, table: str) -> int:
    if not column_exists(conn, table, "user_id"):
        return count_rows(conn, table)
    return conn.execute(
        sa.text(f"SELECT COUNT(*) FROM {table} WHERE user_id IS NULL")
    ).scalar() or 0


def backfill_user_id(conn, table: str) -> None:
    """Safe backfill — raises on ambiguous multi-user orphan state."""
    nulls = count_null_user_id_rows(conn, table)
    if nulls == 0:
        return

    users = count_users(conn)
    if users == 1:
        uid = conn.execute(
            sa.text("SELECT id FROM users ORDER BY id ASC LIMIT 1")
        ).scalar()
        conn.execute(
            sa.text(f"UPDATE {table} SET user_id = :uid WHERE user_id IS NULL"),
            {"uid": uid},
        )
        return

    if users == 0:
        if count_rows(conn, table) > 0:
            raise RuntimeError(
                f"Migration cannot proceed: {table} has {nulls} row(s) with NULL user_id "
                "but no users exist. Create a user first, then re-run migration."
            )
        return

    raise RuntimeError(
        f"Migration cannot proceed: {table} has {nulls} row(s) with NULL user_id "
        f"and {users} users exist. Cannot assign orphan rows automatically — "
        "assign user_id manually, then re-run migration."
    )


def _drop_old_uniques(conn, table: str, old_names: tuple[str, ...]) -> None:
    for name in old_names:
        if constraint_exists(conn, name):
            op.drop_constraint(name, table, type_="unique")
        elif index_exists(conn, table, name):
            op.drop_index(name, table_name=table)


def _create_user_scoped_unique(conn, table: str, name: str, columns: list[str]) -> None:
    if constraint_exists(conn, name) or index_exists(conn, table, name):
        return
    if _dialect(conn) == "sqlite":
        op.create_index(name, table, columns, unique=True)
    else:
        op.create_unique_constraint(name, table, columns)


def _drop_user_scoped_unique(conn, table: str, name: str) -> None:
    if constraint_exists(conn, name):
        op.drop_constraint(name, table, type_="unique")
        return
    if index_exists(conn, table, name):
        op.drop_index(name, table_name=table)


def _ensure_user_scoped_uniques(conn, spec: dict) -> None:
    table = spec["table"]
    new_unique = spec["new_unique"]
    if constraint_exists(conn, new_unique) or index_exists(conn, table, new_unique):
        return
    _drop_old_uniques(conn, table, spec["old_unique_names"])
    _create_user_scoped_unique(conn, table, new_unique, list(spec["unique_columns"]))
    if not index_exists(conn, table, spec["date_index"]):
        op.create_index(spec["date_index"], table, [spec["date_column"]])


def _ensure_user_id_index_and_fk(conn, table: str) -> None:
    fk_name = f"fk_{table}_user_id"
    idx_name = f"ix_{table}_user_id"
    if not index_exists(conn, table, idx_name):
        op.create_index(idx_name, table, ["user_id"])
    if _dialect(conn) != "sqlite" and not constraint_exists(conn, fk_name):
        op.create_foreign_key(fk_name, table, "users", ["user_id"], ["id"])


def _set_user_id_not_null(conn, table: str) -> None:
    if _dialect(conn) == "sqlite":
        with op.batch_alter_table(table) as batch_op:
            batch_op.alter_column("user_id", nullable=False)
    else:
        op.alter_column(table, "user_id", nullable=False)


def _migrate_table(conn, spec: dict) -> None:
    table = spec["table"]
    if not table_exists(conn, table):
        return

    if column_exists(conn, table, "user_id"):
        backfill_user_id(conn, table)
        _set_user_id_not_null(conn, table)
        _ensure_user_id_index_and_fk(conn, table)
        _ensure_user_scoped_uniques(conn, spec)
        return

    if _dialect(conn) == "sqlite":
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
    else:
        op.add_column(table, sa.Column("user_id", sa.Integer(), nullable=True))
    backfill_user_id(conn, table)
    _set_user_id_not_null(conn, table)
    _ensure_user_id_index_and_fk(conn, table)
    _ensure_user_scoped_uniques(conn, spec)


def upgrade() -> None:
    conn = op.get_bind()
    for spec in TABLE_SPECS:
        _migrate_table(conn, spec)


def downgrade() -> None:
    conn = op.get_bind()
    for spec in reversed(TABLE_SPECS):
        table = spec["table"]
        if not table_exists(conn, table) or not column_exists(conn, table, "user_id"):
            continue

        _drop_user_scoped_unique(conn, table, spec["new_unique"])

        date_idx = spec["date_index"]
        if index_exists(conn, table, date_idx):
            op.drop_index(date_idx, table_name=table)

        old_idx = spec["old_unique_names"][1]
        if not index_exists(conn, table, old_idx):
            op.create_index(old_idx, table, [spec["date_column"]], unique=True)

        idx_name = f"ix_{table}_user_id"
        if index_exists(conn, table, idx_name):
            op.drop_index(idx_name, table_name=table)

        fk_name = f"fk_{table}_user_id"
        if constraint_exists(conn, fk_name):
            op.drop_constraint(fk_name, table, type_="foreignkey")

        if _dialect(conn) == "sqlite":
            with op.batch_alter_table(table) as batch_op:
                batch_op.drop_column("user_id")
        else:
            op.drop_column(table, "user_id")
