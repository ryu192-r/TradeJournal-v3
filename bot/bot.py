"""Trading Journal v3 — Telegram Bot entry point."""

from __future__ import annotations

import structlog
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from config import BOT_TOKEN, POST_MARKET_TIME, REMINDER_INTERVAL_MINUTES
from handlers import (
    cmd_help,
    cmd_journal,
    cmd_pnl,
    cmd_setup,
    cmd_start,
    cmd_positions,
    cmd_dashboard,
    cmd_risk,
    cmd_streaks,
    cmd_close,
    cmd_closeid,
    handle_text_message,
)
from middleware import error_handler, require_auth
from utils import send_daily_pnl_summary, send_stop_reminders

logger = structlog.get_logger()
load_dotenv()


# ─── Auth wrapper ────────────────────────────────────

def _auth_wrapper(handler):
    async def wrapped(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not require_auth(update, context):
            return
        await handler(update, context)
    return wrapped


# ─── Scheduled jobs ────────────────────────────────────

async def _job_daily_pnl(context: ContextTypes.DEFAULT_TYPE) -> None:
    await send_daily_pnl_summary(context)


async def _job_stop_reminder(context: ContextTypes.DEFAULT_TYPE) -> None:
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

    app.add_handler(CommandHandler("start", _auth_wrapper(cmd_start)))
    app.add_handler(CommandHandler("help", _auth_wrapper(cmd_help)))
    app.add_handler(CommandHandler("positions", _auth_wrapper(cmd_positions)))
    app.add_handler(CommandHandler("dashboard", _auth_wrapper(cmd_dashboard)))
    app.add_handler(CommandHandler("pnl", _auth_wrapper(cmd_pnl)))
    app.add_handler(CommandHandler("setup", _auth_wrapper(cmd_setup)))
    app.add_handler(CommandHandler("risk", _auth_wrapper(cmd_risk)))
    app.add_handler(CommandHandler("streaks", _auth_wrapper(cmd_streaks)))
    app.add_handler(CommandHandler("close", _auth_wrapper(cmd_close)))
    app.add_handler(CommandHandler("closeid", _auth_wrapper(cmd_closeid)))
    app.add_handler(CommandHandler("journal", _auth_wrapper(cmd_journal)))

    async def _auth_message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not require_auth(update, context):
            return
        await handle_text_message(update, context)

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, _auth_message_handler))
    app.add_handler(MessageHandler(filters.CAPTION & filters.PHOTO, _auth_message_handler))
    app.add_error_handler(error_handler)

    return app


def schedule_jobs(application: Application) -> None:
    """Register recurring scheduled jobs."""
    try:
        hour, minute = map(int, POST_MARKET_TIME.split(":"))
        from datetime import time as dtime
        application.job_queue.run_daily(
            _job_daily_pnl,
            time=dtime(hour, minute),
            name="daily_pnl_summary",
        )
        logger.info("scheduled_daily_pnl", utc_time=POST_MARKET_TIME)
    except Exception as exc:
        logger.error("daily_pnl_schedule_failed", error=str(exc))

    interval_secs = REMINDER_INTERVAL_MINUTES * 60
    try:
        application.job_queue.run_repeating(
            _job_stop_reminder,
            interval=interval_secs,
            first=interval_secs,
            name="stop_reminder",
        )
        logger.info("scheduled_stop_reminder", interval_minutes=REMINDER_INTERVAL_MINUTES)
    except Exception as exc:
        logger.error("stop_reminder_schedule_failed", error=str(exc))


def main() -> None:
    """Start the bot."""
    if not BOT_TOKEN:
        logger.error("no_bot_token", detail="Set TELEGRAM_BOT_TOKEN env var")
        raise SystemExit("TELEGRAM_BOT_TOKEN is not set")

    application = build_application()
    schedule_jobs(application)
    application.run_polling(
        allowed_updates=Update.ALL_TYPES,
        drop_pending_updates=True,
    )


if __name__ == "__main__":
    main()