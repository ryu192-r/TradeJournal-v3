"""market_candles table

Revision ID: 008
Revises: 007
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa

revision = '008_market_candles'
down_revision = '007_webhook_events'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'market_candles',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('symbol', sa.String(20), nullable=False),
        sa.Column('timeframe', sa.String(10), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('open', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('high', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('low', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('close', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('volume', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(20), nullable=False, server_default='cache'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint('symbol', 'timeframe', 'timestamp', 'source', name='uq_candle_symbol_tf_ts_source'),
    )
    op.create_index('ix_candle_symbol_timeframe', 'market_candles', ['symbol', 'timeframe'])
    op.create_index('ix_candle_symbol_timeframe_ts', 'market_candles', ['symbol', 'timeframe', 'timestamp'])


def downgrade() -> None:
    op.drop_index('ix_candle_symbol_timeframe_ts', table_name='market_candles')
    op.drop_index('ix_candle_symbol_timeframe', table_name='market_candles')
    op.drop_table('market_candles')