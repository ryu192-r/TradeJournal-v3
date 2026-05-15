import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# ---------------------------------------------------------------------------
# Add backend root to sys.path so app.* imports work
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Import all models so SQLAlchemy knows about every table
from app.models.base import Base  # noqa: E402
from app.models import (  # noqa: E402, F401
    Trade,
    SetupPlaybook,
    DailyJournal,
    TradeIdea,
    StopHistory,
    CapitalEvent,
    Milestone,
    Account,
    CoachReview,
    User,
)

# ---------------------------------------------------------------------------
# Alembic config
# ---------------------------------------------------------------------------
alembic_config = context.config

if alembic_config.config_file_name is not None:
    fileConfig(alembic_config.config_file_name)

# Load DATABASE_URL from environment (matches docker-compose injection)
DATABASE_URL = os.environ.get("DATABASE_URL", alembic_config.get_main_option("sqlalchemy.url"))

# Override the .ini URL at runtime with the real DATABASE_URL
alembic_config.set_main_option("sqlalchemy.url", DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = alembic_config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        alembic_config.get_section(alembic_config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
