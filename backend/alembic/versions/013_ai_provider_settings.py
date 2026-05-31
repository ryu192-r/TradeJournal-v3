"""Add per-user AI provider settings.

Revision ID: 013_ai_provider_settings
Revises: 012_trade_original_current_stop_split
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "013_ai_provider_settings"
down_revision: Union[str, None] = "012_trade_original_current_stop_split"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, table: str) -> bool:
    if conn.dialect.name == "sqlite":
        row = conn.execute(
            sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name=:table"),
            {"table": table},
        ).fetchone()
        return row is not None
    row = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name = :table"
        ),
        {"table": table},
    ).fetchone()
    return row is not None


def upgrade() -> None:
    conn = op.get_bind()
    if _table_exists(conn, "ai_provider_settings"):
        return

    op.create_table(
        "ai_provider_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("base_url", sa.String(length=500), nullable=False),
        sa.Column("api_key", sa.String(length=4096), nullable=True),
        sa.Column("model", sa.String(length=200), nullable=False),
        sa.Column("timeout", sa.Float(), nullable=False),
        sa.Column("max_retries", sa.Integer(), nullable=False),
        sa.Column("temperature", sa.Float(), nullable=False),
        sa.Column("personality", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_ai_provider_settings_user_id"),
    )
    op.create_index("ix_ai_provider_settings_id", "ai_provider_settings", ["id"], unique=False)
    op.create_index("ix_ai_provider_settings_user_id", "ai_provider_settings", ["user_id"], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "ai_provider_settings"):
        return

    op.drop_index("ix_ai_provider_settings_user_id", table_name="ai_provider_settings")
    op.drop_index("ix_ai_provider_settings_id", table_name="ai_provider_settings")
    op.drop_table("ai_provider_settings")
