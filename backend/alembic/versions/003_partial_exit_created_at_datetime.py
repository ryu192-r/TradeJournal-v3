"""Change partial_exits.created_at to DateTime."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "003_partial_exit_created_at_datetime"
down_revision: Union[str, None] = "002_dashboard_query_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "partial_exits" not in tables:
        return

    columns = {col["name"] for col in inspector.get_columns("partial_exits")}
    if "created_at" not in columns:
        op.add_column("partial_exits", sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()))
        return

    op.add_column("partial_exits", sa.Column("created_at_dt", sa.DateTime(), server_default=sa.func.now()))
    op.execute("UPDATE partial_exits SET created_at_dt = CURRENT_TIMESTAMP WHERE created_at_dt IS NULL")
    with op.batch_alter_table("partial_exits") as batch_op:
        batch_op.drop_column("created_at")
        batch_op.alter_column("created_at_dt", new_column_name="created_at", existing_type=sa.DateTime())


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "partial_exits" not in tables:
        return

    columns = {col["name"] for col in inspector.get_columns("partial_exits")}
    if "created_at" in columns:
        with op.batch_alter_table("partial_exits") as batch_op:
            batch_op.drop_column("created_at")
            batch_op.add_column(sa.Column("created_at", sa.Integer(), nullable=True))
