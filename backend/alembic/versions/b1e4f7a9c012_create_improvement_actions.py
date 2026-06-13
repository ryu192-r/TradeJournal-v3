"""create improvement_actions table (Trading Improvement Loop, ADR-025)

Revision ID: b1e4f7a9c012
Revises: a8f3c1d2e001
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa


revision = 'b1e4f7a9c012'
down_revision = 'a8f3c1d2e001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'improvement_actions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='suggested'),
        sa.Column('due_session', sa.Date(), nullable=True),
        sa.Column('contract_type', sa.String(length=40), nullable=False, server_default='manual_check'),
        sa.Column('contract_params', sa.JSON(), nullable=True),
        sa.Column('source_evidence', sa.JSON(), nullable=True),
        sa.Column('is_daily_focus', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_improvement_actions_id', 'improvement_actions', ['id'])
    op.create_index('ix_improvement_actions_user_id', 'improvement_actions', ['user_id'])
    op.create_index('ix_improvement_actions_due_session', 'improvement_actions', ['due_session'])
    op.create_index('ix_improvement_actions_is_daily_focus', 'improvement_actions', ['is_daily_focus'])


def downgrade() -> None:
    op.drop_index('ix_improvement_actions_is_daily_focus')
    op.drop_index('ix_improvement_actions_due_session')
    op.drop_index('ix_improvement_actions_user_id')
    op.drop_index('ix_improvement_actions_id')
    op.drop_table('improvement_actions')
