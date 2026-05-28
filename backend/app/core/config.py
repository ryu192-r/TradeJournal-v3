"""Application settings loaded from environment variables."""

from decouple import config
from typing import Optional


class Settings:
    # Database settings
    DATABASE_URL: str = config("DATABASE_URL", default="postgresql://user:***@localhost/db")
    
    # API settings
    API_TITLE: str = "Trading Journal v3"
    API_VERSION: str = "0.1.0"
    DEBUG: bool = config("DEBUG", default=False, cast=bool)
    
    # Security settings
    SECRET_KEY: str = config("SECRET_KEY")
    JWT_SECRET_KEY: str = config("JWT_SECRET_KEY")
    JWT_ALGORITHM: str = config("JWT_ALGORITHM", default="HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = config("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", default=30, cast=int)
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = config("JWT_REFRESH_TOKEN_EXPIRE_DAYS", default=7, cast=int)
    
    # Telegram settings
    TELEGRAM_BOT_TOKEN: str = config("TELEGRAM_BOT_TOKEN", default="")
    TELEGRAM_CHAT_ID: str = config("TELEGRAM_CHAT_ID", default="")
    
    # Backup settings
    BACKUP_DIR: str = config("BACKUP_DIR", default="/backups")
    MAX_BACKUPS: int = config("MAX_BACKUPS", default=30, cast=int)
    
    # === AI Coach / Ollama Cloud Settings ===
    OLLAMA_BASE_URL: str = config("OLLAMA_BASE_URL", default="")
    OLLAMA_API_KEY: str = config("OLLAMA_API_KEY", default="")
    OLLAMA_MODEL: str = config("OLLAMA_MODEL", default="mistral")
    OLLAMA_TIMEOUT: float = config("OLLAMA_TIMEOUT", default=60.0, cast=float)
    OLLAMA_MAX_RETRIES: int = config("OLLAMA_MAX_RETRIES", default=3, cast=int)
    
    # Logging
    LOG_LEVEL: str = config("LOG_LEVEL", default="INFO")
    
    # Uploads
    UPLOAD_DIR: str = config("UPLOAD_DIR", default="uploads/charts")
    MAX_UPLOAD_SIZE_MB: int = config("MAX_UPLOAD_SIZE_MB", default=10, cast=int)
    
    # Market Data Provider (Tapetide or other)
    MARKET_DATA_API_URL: str = config("MARKET_DATA_API_URL", default="")
    MARKET_DATA_API_KEY: str = config("MARKET_DATA_API_KEY", default="")
    
    class Config:
        case_sensitive = True


settings = Settings()
