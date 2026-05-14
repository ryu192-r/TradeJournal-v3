from fastapi import FastAPI
from app.core.config import settings
from app.core.rate_limiter import RateLimiter
from app.routers.base import api_router
from app.utils.logging import configure_logging, get_logger
from app.db.database import Base, engine
import app.models  # noqa: F401 — registers all models on Base.metadata
import logging

# Configure logging
configure_logging()
logger = get_logger(__name__)

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    debug=settings.DEBUG,
)

# Register rate limiter middleware
app.add_middleware(RateLimiter)

# Include routers
app.include_router(api_router)

@app.get("/")
async def root():
    logger.info("Root endpoint accessed")
    return {"message": "Welcome to Trading Journal v3"}

@app.get("/health")
async def health_check():
    logger.info("Health check endpoint accessed")
    return {"status": "healthy", "message": "Trading Journal v3 is running"}