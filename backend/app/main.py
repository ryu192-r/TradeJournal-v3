from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.rate_limiter import RateLimiter
from app.routers.base import api_router
from app.utils.logging import configure_logging, get_logger
from app.db.database import Base, engine
from app.models.trade import Trade
from app.db.database import SessionLocal
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

# Backfill trade status for existing trades with old status values
def _backfill_trade_statuses():
    try:
        db = SessionLocal()
        old_statuses = ["draft", "reviewed", "analytics"]
        affected = db.query(Trade).filter(Trade.status.in_(old_statuses)).all()
        for t in affected:
            t.status = "closed" if t.exit_price is not None else "open"
        db.commit()
        if affected:
            logger.info(f"Backfilled {len(affected)} trade(s) with old status values")
        db.close()
    except Exception as e:
        logger.warning(f"Trade status backfill skipped: {e}")

_backfill_trade_statuses()

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