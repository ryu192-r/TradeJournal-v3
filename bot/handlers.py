"""Telegram bot command and message handlers.

Every handler follows this pattern:
1. Validate auth (done by wrapper in bot.py)
2. Call backend API via BackendClient
3. Format responses for Telegram (Markdown, HTML)
4. Reply to user
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

import structlog
from telegram import Update
from telegram.ext import ContextTypes

from client import BackendClient
from parser import parse_trade_message, format_trade_summary
from utils import (
    fmt_currency,
    fmt_date,
    format_open_trades,
    format_setup_leaderboard,
    format_pnl_report,
    format_journal_summary,
)

logger = structlog.get_logger()

IST = timezone(timedelta(hours=5, minutes=30))


# ─── /start ────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Welcome message with usage instructions."""
    greeting = f"Welcome to Trading Journal v3, {update.effective_user.first_name}! 📊"
    instructions = (
        "I can help you with:\n\n"
        "📝 *Trade Logging* — Send a message like:\n"
        "   Bought RELIANCE 50 @ 2650 SL 2620 TGT 2750 VWAP bounce\n\n"
        "📈 */pnl* — Last 7 days PnL report with win rate\n"
        "📖 */journal* — Today's market wrap-up\n"
        "🎯 */setup* — Setup performance leaderboard\n\n"
        "Use /help for all available commands."
    )
    await update.message.reply_text(
        f"{greeting}\n\n{instructions}",
        parse_mode="Markdown",
    )


# ─── /help ─────────────────────────────────────────────

async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """List all commands with examples."""
    help_text = (
        "📊 *Trading Journal — Commands*\n\n"
        "*Trade Logging (free form):*\n"
        "  Bought RELIANCE 50 @ 2650.50 SL 2620 TGT 2750 VWAP bounce\n"
        "  Short TATASTEEL 100 at 145.20 SL 148 target 140 breakout\n\n"
        "*Commands:*\n"
        "  /start — Welcome message\n"
        "  /pnl — Last 7 days PnL summary\n"
        "  /journal — Today's journal entry\n"
        "  /setup — Setup performance leaderboard\n"
        "  /help — Show this message"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")


# ─── /pnl — Last 7 days PnL report ─────────────────────────────

async def cmd_pnl(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show last 7 days P&L summary."""
    client = BackendClient()
    days = 7

    # Get all reviewed trades and filter by date
    try:
        all_trades = await client.list_trades(
            limit=500, status="reviewed"
        )
    except Exception as exc:
        await update.message.reply_text("Failed to fetch trades data.")
        logger.error("pnl_fetch_failed", error=str(exc))
        return

    # Filter to last 7 days
    cutoff = (datetime.now() - timedelta(days=days)).date()
    recent = []
    for t in all_trades:
        entry_str = t.get("entry_time", "")[:10]
        try:
            entry_date = datetime.fromisoformat(entry_str).date()
            if entry_date >= cutoff:
                recent.append(t)
        except (ValueError, TypeError):
            continue

    report = format_pnl_report(recent, days=days)
    await update.message.reply_text(report, parse_mode="Markdown")


# ─── /journal — Today's journal summary ─────────────────────────

async def cmd_journal(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show today's journal entry."""
    client = BackendClient()
    today = date.today().isoformat()

    try:
        journal = await client.get_journal_today(today)
    except Exception as exc:
        await update.message.reply_text("Failed to fetch journal data.")
        logger.error("journal_fetch_failed", error=str(exc))
        return

    if not journal:
        await update.message.reply_text(
            "No journal entry found for today. Write one in the web app! 📝"
        )
        return

    summary = format_journal_summary(journal, today)
    await update.message.reply_text(summary, parse_mode="Markdown")


# ─── /setup — Setup leaderboard ─────────────────────────

async def cmd_setup(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show setup performance leaderboard."""
    client = BackendClient()

    try:
        setup_perf = await client.get_setup_performance()
        setups_list = await client._get("/setups/")
    except Exception as exc:
        await update.message.reply_text("Failed to fetch setup data.")
        logger.error("setup_fetch_failed", error=str(exc))
        return

    report = format_setup_leaderboard(setup_perf, setups_list.get("items", []))
    await update.message.reply_text(report, parse_mode="Markdown")


# ─── Free-form trade messages ──────────────────────────

async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Parse a free-form trade message, show confirmation, create via backend."""
    text = update.message.text or update.message.caption or ""
    if not text.strip():
        return

    parsed = parse_trade_message(text)
    if not parsed:
        await update.message.reply_text(
            "I couldn't parse that as a trade. Try format:\n"
            "Bought SYMBOL qty @ price SL stop TGT target notes\n\n"
            "Example: Bought RELIANCE 50 @ 2650 SL 2620 TGT 2750 VWAP bounce"
        )
        return

    # Show confirmation
    confirmation = format_trade_summary(parsed)
    msg = await update.message.reply_text(
        confirmation, parse_mode="Markdown"
    )

    # Create trade via backend
    client = BackendClient()
    try:
        # Build payload matching TradeCreate schema
        payload = {
            "symbol": parsed.symbol,
            "direction": parsed.direction,
            "entry_price": parsed.entry_price,
            "quantity": parsed.quantity or 1,  # Default 1 if not parsed
            "entry_time": parsed.entry_time or datetime.now(IST).isoformat(),
            "notes": parsed.notes,
        }
        # Optional fields
        if parsed.stop_price is not None:
            payload["stop_price"] = parsed.stop_price
        if parsed.target_price is not None:
            payload["target_price"] = parsed.target_price

        created = await client.create_trade(payload)
        status_emoji = "✅"
        extra = f"\n\nTrade ID: {created.get('id', 'N/A')}"
    except Exception as exc:
        status_emoji = "⚠️"
        extra = f"\n\nFailed to save to backend: {exc}"
        logger.error("trade_create_failed", parsed=parsed, error=str(exc))

    await update.message.reply_text(f"{status_emoji} {extra}")
