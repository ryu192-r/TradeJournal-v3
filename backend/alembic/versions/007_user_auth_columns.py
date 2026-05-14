"""Add hashed_password and is_active columns to users table.

Adds JWT authentication support by requiring a password hash on every
user and an is_active flag for soft account deactivation.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '007_user_auth_columns'
down_revision: Union[str, None] = '5005c9868b86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('hashed_password', sa.String(), nullable=False, server_default=''))
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'hashed_password')
