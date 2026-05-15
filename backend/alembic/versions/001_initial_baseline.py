"""Initial baseline — marks the starting point for schema migrations.

This migration is intentionally empty. Tables are created by SQLAlchemy's
``Base.metadata.create_all()`` on application startup (see ``app/main.py``),
which is idempotent and always matches the current models.

How to create future migrations
--------------------------------
1. Start a local PostgreSQL instance (or use Docker).
2. Set ``DATABASE_URL`` to point to it.
3. Run the app once so ``create_all`` populates the schema.
4. Run::

       cd backend
       alembic revision --autogenerate -m "description_of_change"

5. Review the generated migration in ``alembic/versions/``.
6. The app will run ``alembic upgrade head`` on startup (with ``create_all``
   as fallback for fresh databases).

For an existing database that was created by ``create_all``, stamp it so
future migrations know the current revision::

    alembic stamp head
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial_baseline'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
