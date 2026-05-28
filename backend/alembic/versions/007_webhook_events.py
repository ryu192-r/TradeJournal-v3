"""Add webhook_events table for replay dedup.

Revision ID: 007_webhook_events
Revises: 006_trade_import_identity
Create Date: 2026-05-28
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '007_webhook_events'
down_revision: Union[str, None] = '006_trade_import_identity'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'webhook_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'event_id', name='uq_webhook_events_user_event'),
    )
    op.create_index('ix_webhook_events_id', 'webhook_events', ['id'])
    op.create_index('ix_webhook_events_user_id', 'webhook_events', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_webhook_events_user_id', table_name='webhook_events')
    op.drop_index('ix_webhook_events_id', table_name='webhook_events')
    op.drop_table('webhook_events')
