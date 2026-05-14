"""Telegram bot configuration — all env vars live here."""

import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHAT_ID: str | None = os.getenv("TELEGRAM_CHAT_ID")
BACKEND_URL: str = os.getenv("BACKEND_URL", "http://backend:8000/api/v1")

# Scheduled job times (UTC). IST = UTC+5:30
# Market opens 9:15 IST (03:45 UTC), closes 15:30 IST (10:00 UTC)
PRE_MARKET_TIME: str = os.getenv("PRE_MARKET_TIME", "03:15")   # 08:45 IST
POST_MARKET_TIME: str = os.getenv("POST_MARKET_TIME", "10:00")  # 15:30 IST
PRE_MARKET_REMINDER: str = os.getenv("PRE_MARKET_REMINDER", "03:00")  # 30 min before open
WEEKLY_REVIEW_DAY: str = os.getenv("WEEKLY_REVIEW_DAY", "6")    # 0=Mon..6=Sun
WEEKLY_REVIEW_TIME: str = os.getenv("WEEKLY_REVIEW_TIME", "14:30")  # 20:00 IST

REMINDER_INTERVAL_MINUTES: int = int(os.getenv("REMINDER_INTERVAL_MINUTES", "120"))

# Alert thresholds
DRAWDOWN_ALERT_PCT: float = float(os.getenv("DRAWDOWN_ALERT_PCT", "5.0"))
LOSS_STREAK_ALERT: int = int(os.getenv("LOSS_STREAK_ALERT", "3"))
