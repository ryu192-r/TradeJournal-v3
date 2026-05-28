"""Add import identity columns to trades for idempotency.

Revision ID: 006_trade_import_identity
Revises: 005_refresh_tokens
Create Date: 2026-05-28
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '006_trade_import_identity'
down_revision: Union[str, None] = '005_refresh_tokens'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('trades', sa.Column('import_source', sa.String(30), nullable=True))
    op.add_column('trades', sa.Column('import_fingerprint', sa.String(64), nullable=True))
    op.add_column('trades', sa.Column('external_order_id', sa.String(100), nullable=True))
    op.create_index('ix_trades_import_fingerprint', 'trades', ['user_id', 'import_fingerprint'])

    # Partial unique index for PostgreSQL: prevents duplicate fingerprints per user.
    # SQLite doesn't support partial unique indexes; app-level check covers SQLite.
    # Using batch_alter_table for cross-database compatibility.
    with op.batch_alter_table('trades') as batch_op:
        batch_op.create_index(
            'ix_trades_import_fingerprint_unique',
            ['user_id', 'import_fingerprint'],
            unique=True,
            postgresql_where=sa.text('import_fingerprint IS NOT NULL'),
        )


def downgrade() -> None:
    with op.batch_alter_table('trades') as batch_op:
        batch_op.drop_index('ix_trades_import_fingerprint_unique', if_exists=True)
    op.drop_index('ix_trades_import_fingerprint', table_name='trades')
    op.drop_column('trades', 'external_order_id')
    op.drop_column('trades', 'import_fingerprint')
    op.drop_column('trades', 'import_source')
