from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.rate_limiter import RateLimiter
from app.routers.base import api_router
from app.utils.logging import configure_logging, get_logger
from app.db.database import Base, engine
import app.models  # noqa: F401 — registers all models on Base.metadata
import logging
from alembic.config import Config
from alembic import command
import os

# Configure logging
configure_logging()
logger = get_logger(__name__)

# Run alembic migrations on startup
def run_migrations():
    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", str(engine.url))
    try:
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations applied successfully")
    except Exception as e:
        logger.warning(f"Alembic migration failed, falling back to create_all: {e}")
        Base.metadata.create_all(bind=engine)

run_migrations()

app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    debug=settings.DEBUG,
)

# Register rate limiter middleware
app.add_middleware(RateLimiter)

# Include routers
app.include_router(api_router)

# Serve uploaded chart images
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

@app.get("/")
async def root():
    logger.info("Root endpoint accessed")
    return {"message": "Welcome to Trading Journal v3"}

@app.get("/health")
async def health_check():
    logger.info("Health check endpoint accessed")
    return {"status": "healthy", "message": "Trading Journal v3 is running"}