from contextlib import asynccontextmanager
from threading import Lock
import sys

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.rate_limiter import RateLimiter
from app.routers.base import api_router
from app.utils.logging import configure_logging, get_logger
from app.db.database import Base, engine
from app.models.trade import Trade
from app.db.database import SessionLocal
from app.services.live_quote_sync import is_market_open, sync_open_trade_quotes
import app.models  # noqa: F401 — registers all models on Base.metadata
import logging
import time
from alembic.config import Config
from alembic import command
import os

# Configure logging
configure_logging()
logger = get_logger(__name__)

def _is_test_mode() -> bool:
    return "pytest" in sys.modules


def _allow_create_all_fallback() -> bool:
    return settings.DEBUG or _is_test_mode()


def run_migrations():
    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", str(engine.url))
    try:
        command.upgrade(alembic_cfg, "head")
        logger.info("database_migrations_applied", mode="alembic")
    except Exception as e:
        logger.error("database_migrations_failed", error=str(e))
        if not _allow_create_all_fallback():
            raise
        logger.warning("database_schema_dev_fallback", mode="create_all", reason="alembic_failed")
        Base.metadata.create_all(bind=engine)
        logger.info("database_tables_ensured", mode="create_all_dev_fallback")

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

quote_sync_lock = Lock()


def _run_live_quote_sync_job():
    if not is_market_open():
        return
    if not quote_sync_lock.acquire(blocking=False):
        logger.info("live_quote_sync_skipped", reason="previous_sync_still_running")
        return

    db = SessionLocal()
    try:
        result = sync_open_trade_quotes(db)
        logger.info(
            "live_quote_scheduler_tick",
            fetched=result.get("fetched", 0),
            upserted=result.get("upserted", 0),
            errors=len(result.get("errors", [])),
            provider_status=result.get("provider_status"),
        )
    except Exception as exc:
        logger.exception("live_quote_scheduler_failed", error=str(exc))
        db.rollback()
    finally:
        db.close()
        quote_sync_lock.release()


def _should_start_live_quote_scheduler() -> bool:
    return "pytest" not in sys.modules


@asynccontextmanager
async def lifespan(_: FastAPI):
    scheduler = None
    if _should_start_live_quote_scheduler():
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
        scheduler.add_job(
            _run_live_quote_sync_job,
            trigger=IntervalTrigger(seconds=180),
            id="live-quote-sync",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )
        scheduler.start()
        logger.info("live_quote_scheduler_started", interval_seconds=180)

    try:
        yield
    finally:
        if scheduler:
            scheduler.shutdown(wait=False)
            logger.info("live_quote_scheduler_stopped")


app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# Register rate limiter middleware
app.add_middleware(RateLimiter)

# Timing middleware — logs every HTTP endpoint duration
@app.middleware("http")
async def timing_middleware(request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = (time.perf_counter() - start) * 1000
    # Skip health/ping noise
    if settings.DEBUG and request.url.path not in ("/health", "/"):
        logger.info(f"{request.method} {request.url.path} {duration:.1f}ms")
    return response
app.include_router(api_router)

# Serve uploaded chart images via authenticated endpoint only (GET /trades/{trade_id}/images/{filename})
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
if settings.DEBUG:
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

@app.get("/")
async def root():
    logger.info("Root endpoint accessed")
    return {"message": "Welcome to Trading Journal v3"}

@app.get("/health")
async def health_check():
    logger.info("Health check endpoint accessed")
    return {"status": "healthy", "message": "Trading Journal v3 is running"}
