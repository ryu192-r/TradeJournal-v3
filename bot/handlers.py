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
    format_positions,
    format_dashboard,
    format_risk_summary,
    format_streaks,
)

logger = structlog.get_logger()

IST = timezone(timedelta(hours=5, minutes=30))


# ─── /start ────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    greeting = f"Welcome to Trading Journal v3, {update.effective_user.first_name}! 📊"
    instructions = (
        "I can help you with:\n\n"
        "📝 *Trade Logging* — Send a message like:\n"
        "   Bought RELIANCE 50 @ 2650 SL 2620 TGT 2750 VWAP bounce\n\n"
        "📋 */positions* — Open positions with risk\n"
        "📊 */dashboard* — Full KPI + capital snapshot\n"
        "📈 */pnl* — Last 7 days PnL report\n"
        "🎯 */setup* — Setup performance leaderboard\n"
        "⚠️ */risk* — Portfolio risk command center\n"
        "🔥 */streaks* — Win/loss streak info\n"
        "📕 */close SYMBOL @ price* — Close a trade\n"
        "📖 */journal* — Today's market wrap-up\n\n"
        "Use /help for all available commands."
    )
    await update.message.reply_text(
        f"{greeting}\n\n{instructions}",
        parse_mode="Markdown",
    )


# ─── /help ─────────────────────────────────────────────

async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    help_text = (
        "📊 *Trading Journal — All Commands*\n\n"
        "*Trade Logging (free form):*\n"
        "  Bought RELIANCE 50 @ 2650.50 SL 2620 TGT 2750 VWAP bounce\n"
        "  Closed RELIANCE @ 2700\n\n"
        "*Commands:*\n"
        "  /start — Welcome message\n"
        "  /help — Show this message\n"
        "  /positions — Open positions with entry, SL, risk\n"
        "  /dashboard — KPIs, capital, risk, streaks snapshot\n"
        "  /pnl — Last 7 days PnL summary\n"
        "  /setup — Setup performance leaderboard\n"
        "  /risk — Portfolio heat, deployed capital, warnings\n"
        "  /streaks — Current and longest win/loss streaks\n"
        "  /close SYMBOL @ price — Close an open trade\n"
        "  /journal — Today's journal entry\n"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")


# ─── /positions — Open positions with risk ──────────────

async def cmd_positions(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    client = BackendClient()
    try:
        open_trades = await client.list_open_trades()
        dashboard = await client.get_operational_dashboard()
    except Exception as exc:
        await update.message.reply_text("Failed to fetch positions.")
        logger.error("positions_fetch_failed", error=str(exc))
        return

    msg = format_positions(open_trades, dashboard)
    await update.message.reply_text(msg, parse_mode="Markdown")


# ─── /dashboard — Full KPI snapshot ─────────────────────

async def cmd_dashboard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    client = BackendClient()
    try:
        dashboard = await client.get_operational_dashboard()
    except Exception as exc:
        await update.message.reply_text("Failed to fetch dashboard data.")
        logger.error("dashboard_fetch_failed", error=str(exc))
        return

    msg = format_dashboard(dashboard)
    await update.message.reply_text(msg, parse_mode="Markdown")


# ─── /pnl — Last 7 days PnL report ──────────────────────

async def cmd_pnl(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    client = BackendClient()
    days = 7

    if context.args and len(context.args) > 0:
        try:
            days = int(context.args[0])
        except ValueError:
            pass

    try:
        from_date = (date.today() - timedelta(days=days)).isoformat()
        trades = await client.list_trades(
            limit=500, status="closed", from_date=from_date
        )
    except Exception as exc:
        await update.message.reply_text("Failed to fetch trades data.")
        logger.error("pnl_fetch_failed", error=str(exc))
        return

    report = format_pnl_report(trades, days=days)
    await update.message.reply_text(report, parse_mode="Markdown")


# ─── /setup — Setup leaderboard ─────────────────────────

async def cmd_setup(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    client = BackendClient()

    try:
        setup_perf = await client.get_setup_performance()
    except Exception as exc:
        await update.message.reply_text("Failed to fetch setup data.")
        logger.error("setup_fetch_failed", error=str(exc))
        return

    report = format_setup_leaderboard(setup_perf)
    await update.message.reply_text(report, parse_mode="Markdown")


# ─── /risk — Portfolio risk command center ──────────────

async def cmd_risk(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    client = BackendClient()

    try:
        dashboard = await client.get_operational_dashboard()
    except Exception as exc:
        await update.message.reply_text("Failed to fetch risk data.")
        logger.error("risk_fetch_failed", error=str(exc))
        return

    msg = format_risk_summary(dashboard)
    await update.message.reply_text(msg, parse_mode="Markdown")


# ─── /streaks — Win/loss streaks ────────────────────────

async def cmd_streaks(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    client = BackendClient()

    try:
        dashboard = await client.get_operational_dashboard()
    except Exception as exc:
        await update.message.reply_text("Failed to fetch streak data.")
        logger.error("streaks_fetch_failed", error=str(exc))
        return

    msg = format_streaks(dashboard)
    await update.message.reply_text(msg, parse_mode="Markdown")


# ─── /close — Close an open trade ───────────────────────

async def cmd_close(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Close an open trade: /close SYMBOL @ price"""
    if not context.args or len(context.args) < 2:
        await update.message.reply_text(
            "Usage: `/close SYMBOL @ price`\n\n"
            "Example: `/close RELIANCE @ 2700`",
            parse_mode="Markdown",
        )
        return

    symbol = context.args[0].upper().strip(".,!?")
    price_str = " ".join(context.args[1:]).replace("@", "").replace(",", "").strip()
    try:
        exit_price = float(price_str)
    except ValueError:
        await update.message.reply_text(
            f"Invalid price: `{price_str}`\n\nUsage: `/close SYMBOL @ price`",
            parse_mode="Markdown",
        )
        return

    client = BackendClient()
    try:
        open_trades = await client.list_open_trades()
    except Exception as exc:
        await update.message.reply_text("Failed to fetch open trades.")
        logger.error("close_fetch_failed", error=str(exc))
        return

    matching = [t for t in open_trades if t.get("symbol", "").upper() == symbol]
    if not matching:
        await update.message.reply_text(
            f"No open position found for *{symbol}*",
            parse_mode="Markdown",
        )
        return

    if len(matching) > 1:
        lines = [f"Multiple open positions for *{symbol}*:"]
        for i, t in enumerate(matching, 1):
            entry = t.get("entry_price", "?")
            qty = t.get("quantity", "?")
            tid = t.get("id", "?")
            lines.append(f"  {i}. ID {tid}: ₹{entry} x {qty}")
        lines.append(f"\nUse: `/closeid TRADE_ID @ price`")
        await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
        return

    trade = matching[0]
    trade_id = trade.get("id")
    try:
        result = await client.update_trade(trade_id, {
            "exit_price": exit_price,
            "exit_time": datetime.now(IST).isoformat(),
        })
        tid = result.get("id", trade_id) if isinstance(result, dict) else trade_id
        pnl = trade.get("pnl")
        await update.message.reply_text(
            f"✅ *Closed {symbol}*\n"
            f"  Exit: ₹{exit_price:,.2f}\n"
            f"  Trade ID: {tid}",
            parse_mode="Markdown",
        )
    except Exception as exc:
        await update.message.reply_text(f"Failed to close trade: {exc}")
        logger.error("close_trade_failed", symbol=symbol, error=str(exc))


# ─── /closeid — Close by trade ID ──────────────────────

async def cmd_closeid(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Close a specific trade by ID: /closeid ID @ price"""
    if not context.args or len(context.args) < 2:
        await update.message.reply_text(
            "Usage: `/closeid TRADE_ID @ price`",
            parse_mode="Markdown",
        )
        return

    try:
        trade_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text(f"Invalid trade ID: `{context.args[0]}`", parse_mode="Markdown")
        return

    price_str = " ".join(context.args[1:]).replace("@", "").replace(",", "").strip()
    try:
        exit_price = float(price_str)
    except ValueError:
        await update.message.reply_text(f"Invalid price: `{price_str}`", parse_mode="Markdown")
        return

    client = BackendClient()
    try:
        trade = await client.get_trade(trade_id)
        if isinstance(trade, dict) and trade.get("data"):
            trade = trade["data"]
        symbol = trade.get("symbol", "?") if isinstance(trade, dict) else "?"
        if isinstance(trade, dict) and trade.get("exit_price") is not None:
            await update.message.reply_text(f"Trade {trade_id} is already closed.")
            return
    except Exception:
        symbol = "?"

    try:
        result = await client.update_trade(trade_id, {
            "exit_price": exit_price,
            "exit_time": datetime.now(IST).isoformat(),
        })
        await update.message.reply_text(
            f"✅ *Closed {symbol}*\n"
            f"  Exit: ₹{exit_price:,.2f}\n"
            f"  Trade ID: {trade_id}",
            parse_mode="Markdown",
        )
    except Exception as exc:
        await update.message.reply_text(f"Failed to close trade: {exc}")
        logger.error("closeid_failed", trade_id=trade_id, error=str(exc))


# ─── /journal — Today's journal summary ────────────────

async def cmd_journal(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    client = BackendClient()
    today = date.today().isoformat()

    try:
        journal = await client.get_journal(today)
    except Exception as exc:
        await update.message.reply_text("Failed to fetch journal data.")
        logger.error("journal_fetch_failed", error=str(exc))
        return

    if not journal or (isinstance(journal, dict) and not journal.get("pre_market_notes") and not journal.get("post_market_notes")):
        await update.message.reply_text(
            "No journal entry found for today. Write one in the web app! 📝"
        )
        return

    summary = format_journal_summary(journal, today)
    await update.message.reply_text(summary, parse_mode="Markdown")


# ─── Free-form trade messages ──────────────────────────

async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = update.message.text or update.message.caption or ""
    if not text.strip():
        return

    parsed = parse_trade_message(text)
    if not parsed:
        await update.message.reply_text(
            "I couldn't parse that as a trade. Try format:\n"
            "Bought SYMBOL qty @ price SL stop TGT target notes\n\n"
            "Example: Bought RELIANCE 50 @ 2650 SL 2620 TGT 2750 VWAP bounce\n\n"
            "Or use /help for all commands."
        )
        return

    if parsed.intent == "exit" and parsed.symbol and parsed.exit_price:
        client = BackendClient()
        try:
            open_trades = await client.list_open_trades()
            matching = [t for t in open_trades if t.get("symbol", "").upper() == parsed.symbol.upper()]
            if not matching:
                confirmation = format_trade_summary(parsed)
                await update.message.reply_text(confirmation, parse_mode="Markdown")
                await update.message.reply_text(
                    f"No open position found for *{parsed.symbol}*. Close it in the web app.",
                    parse_mode="Markdown",
                )
                return
            trade = matching[0]
            trade_id = trade.get("id")
            result = await client.update_trade(trade_id, {
                "exit_price": parsed.exit_price,
                "exit_time": datetime.now(IST).isoformat(),
            })
            await update.message.reply_text(
                f"🔴 *Closed {parsed.symbol}*\n"
                f"  Exit: ₹{parsed.exit_price:,.2f}\n"
                f"  Trade ID: {trade_id}",
                parse_mode="Markdown",
            )
            return
        except Exception as exc:
            await update.message.reply_text(f"Failed to close trade: {exc}")
            logger.error("exit_close_failed", parsed=parsed, error=str(exc))
            return

    confirmation = format_trade_summary(parsed)
    await update.message.reply_text(confirmation, parse_mode="Markdown")

    client = BackendClient()
    try:
        payload = {
            "symbol": parsed.symbol,
            "direction": parsed.direction,
            "entry_price": parsed.entry_price,
            "quantity": parsed.quantity or 1,
            "entry_time": parsed.entry_time or datetime.now(IST).isoformat(),
            "notes": parsed.notes,
        }
        if parsed.stop_price is not None:
            payload["stop_price"] = parsed.stop_price
        if parsed.target_price is not None:
            payload["target_price"] = parsed.target_price

        created = await client.create_trade(payload)
        trade_data = created.get("data", created) if isinstance(created, dict) else created
        tid = trade_data.get("id", "N/A") if isinstance(trade_data, dict) else "N/A"
        await update.message.reply_text(f"✅ Trade saved\n\nTrade ID: {tid}")
    except Exception as exc:
        await update.message.reply_text(f"⚠️ Failed to save: {exc}")
        logger.error("trade_create_failed", parsed=parsed, error=str(exc))