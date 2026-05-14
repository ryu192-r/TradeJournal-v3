"""Trading Journal v3 — Telegram Bot entry point.

Initialises python-telegram-bot Application with:
- Command handlers for /start, /help, /pnl, /journal, /setup
- Text message handler for free-form trade logging
- Scheduled jobs: daily PnL summary at market close, stop reminders
"""

from __future__ import annotations

import asyncio

import structlog
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from config import BOT_TOKEN, POST_MARKET_TIME, REMINDER_INTERVAL_MINUTES
from handlers import (
    cmd_help,
    cmd_journal,
    cmd_pnl,
    cmd_setup,
    cmd_start,
    handle_text_message,
)
from middleware import error_handler, require_auth
from utils import send_daily_pnl_summary, send_stop_reminders

logger = structlog.get_logger()

load_dotenv()


# ─── Command handlers ──────────────────────────────────

def _auth_wrapper(handler):
    """Wrap a handler with auth check (chat_id whitelist)."""

    async def wrapped(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not require_auth(update, context):
            return
        await handler(update, context)

    return wrapped


# ─── Scheduled jobs ────────────────────────────────────

async def _job_daily_pnl(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Daily PnL summary sent at market close (3:30 IST)."""
    await send_daily_pnl_summary(context)


async def _job_stop_reminder(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Periodic reminder for open trades to check stops."""
    await send_stop_reminders(context)


# ─── Main ──────────────────────────────────────────────

def build_application() -> Application:
    """Build and configure the Telegram bot Application."""
    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .connect_timeout(10.0)
        .read_timeout(10.0)
        .build()
    )

    # Command handlers
    app.add_handler(CommandHandler("start", _auth_wrapper(cmd_start)))
    app.add_handler(CommandHandler("help", _auth_wrapper(cmd_help)))
    app.add_handler(CommandHandler("pnl", _auth_wrapper(cmd_pnl)))
    app.add_handler(CommandHandler("journal", _auth_wrapper(cmd_journal)))
    app.add_handler(CommandHandler("setup", _auth_wrapper(cmd_setup)))

    # Free-form trade messages (authed)
    async def _auth_message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not require_auth(update, context):
            return
        await handle_text_message(update, context)

    app.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, _auth_message_handler)
    )

    # Also handle photo captions (user might send chart + trade text)
    app.add_handler(
        MessageHandler(filters.CAPTION & filters.PHOTO, _auth_message_handler)
    )

    # Error handler
    app.add_error_handler(error_handler)

    return app


async def schedule_jobs(application: Application) -> None:
    """Register recurring scheduled jobs.

    - Daily PnL summary at POST_MARKET_TIME (default 10:00 UTC = 15:30 IST)
    - Stop reminder every REMINDER_INTERVAL_MINUTES (default 120 min)
    """
    try:
        # Parse HH:MM into hour/minute for daily job
        hour, minute = map(int, POST_MARKET_TIME.split(":"))
        application.job_queue.run_daily(
            _job_daily_pnl,
            time=__import__("datetime").time(hour, minute),
            name="daily_pnl_summary",
        )
        logger.info(
            "scheduled_daily_pnl",
            utc_time=POST_MARKET_TIME,
            note="IST market close summary",
        )
    except Exception as exc:
        logger.error("daily_pnl_schedule_failed", error=str(exc))

    # Stop reminder every N minutes
    interval_secs = REMINDER_INTERVAL_MINUTES * 60
    application.job_queue.run_repeating(
        _job_stop_reminder,
        interval=interval_secs,
        first=interval_secs,
        name="stop_reminder",
    )
    logger.info(
        "scheduled_stop_reminder",
        interval_min=REMINDER_INTERVAL_MINUTES,
    )


def main() -> None:
    """Start the bot."""
    if not BOT_TOKEN:
        logger.error("no_bot_token", detail="Set TELEGRAM_BOT_TOKEN env var")
        raise SystemExit("TELEGRAM_BOT_TOKEN is not set")

    application = build_application()

    # Schedule jobs before starting
    async def _init_and_run() -> None:
        await schedule_jobs(application)
        await application.run_polling(
            allowed_updates=Update.ALL_TYPES,
            drop_pending_updates=True,
        )

    asyncio.run(_init_and_run())


if __name__ == "__main__":
    main()
