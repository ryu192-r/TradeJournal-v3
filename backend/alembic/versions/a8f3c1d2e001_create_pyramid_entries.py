"""create pyramid_entries table

Revision ID: a8f3c1d2e001
Revises: 
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa


revision = 'a8f3c1d2e001'
down_revision = '018_trade_market_metadata'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'pyramid_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('trade_id', sa.Integer(), sa.ForeignKey('trades.id'), nullable=False),
        sa.Column('entry_price', sa.Numeric(precision=18, scale=8), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=18, scale=8), nullable=False),
        sa.Column('entry_time', sa.DateTime(), nullable=False),
        sa.Column('fees', sa.Numeric(precision=18, scale=8), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_pyramid_entries_id', 'pyramid_entries', ['id'])
    op.create_index('ix_pyramid_entries_trade_id', 'pyramid_entries', ['trade_id'])
    op.create_index('ix_pyramid_entries_trade_time', 'pyramid_entries', ['trade_id', 'entry_time'])


def downgrade() -> None:
    op.drop_index('ix_pyramid_entries_trade_time')
    op.drop_index('ix_pyramid_entries_trade_id')
    op.drop_index('ix_pyramid_entries_id')
    op.drop_table('pyramid_entries')
