"""Bot middleware — auth guard, error handler, rate limiting."""

from __future__ import annotations

import structlog
from telegram import Update
from telegram.ext import ContextTypes

from config import CHAT_ID

logger = structlog.get_logger()


def require_auth(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """Check if the user's chat_id matches the configured CHAT_ID.

    Returns False and sends a polite denial if unauthorized.
    If CHAT_ID is not configured, allows all (dev mode).
    """
    if not CHAT_ID:
        # Dev mode: no chat ID restriction
        return True

    # Normalize incoming chat ID
    incoming = _resolve_chat_id(update)
    if incoming is None:
        return False

    if str(incoming) == str(CHAT_ID):
        return True

    logger.warning("unauthorized_attempt", chat_id=incoming)
    # Don't respond — silence is the best policy for unauthorized access
    return False


def _resolve_chat_id(update: Update) -> int | None:
    """Extract chat_id from various update sources."""
    if update.message and update.message.chat:
        return update.message.chat.id
    if update.callback_query and update.callback_query.message:
        return update.callback_query.message.chat_id
    return None


async def error_handler(
    update: object, context: ContextTypes.DEFAULT_TYPE
) -> None:
    """Global error handler — logs and notifies on critical errors."""
    error = context.error
    logger.error("bot_error", error=str(error), error_type=type(error).__name__)

    # Notify user about the error
    if isinstance(update, Update) and update.effective_message:
        try:
            await update.effective_message.reply_text(
                "⚠️ Something went wrong. Please try again later.\n"
                f"_Error: {error}_",
                parse_mode="Markdown",
            )
        except Exception:
            pass  # Don't double-fail
