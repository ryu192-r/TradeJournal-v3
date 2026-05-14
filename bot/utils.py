"""Formatting helpers for Telegram bot messages and scheduled jobs."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import structlog
from telegram.ext import ContextTypes

from client import BackendClient

logger = structlog.get_logger()

IST = timezone(timedelta(hours=5, minutes=30))


# ─── Currency / date formatting ────────────────────────

def fmt_currency(value: float | Decimal | None, decimals: int = 2) -> str:
    """Format a monetary value as ₹ with sign."""
    if value is None:
        return "₹0.00"
    val = float(value)
    sign = "+" if val >= 0 else "-"
    return f"{sign}₹{abs(val):,.{decimals}f}"


def fmt_date(iso_str: str) -> str:
    """Convert ISO datetime to readable DD MMM format."""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%d %b")
    except (ValueError, AttributeError):
        return iso_str[:10]


# ─── Report formatters ─────────────────────────────────

def format_pnl_report(trades: list[dict], days: int = 7) -> str:
    """Format a PnL report for telegram.

    Shows:
    - Total trades, wins, losses
    - Win rate
    - Total PnL
    - Best and worst trade
    - Per-day breakdown (optional)
    """
    if not trades:
        return (
            f"📊 *PnL Summary (Last {days} days)*\n\n"
            "No reviewed trades in this period."
        )

    total = len(trades)
    pnl_values: list[float] = []
    for t in trades:
        p = t.get("pnl")
        if p is not None:
            pnl_values.append(float(p))

    wins = sum(1 for p in pnl_values if p > 0)
    losses = total - wins
    win_rate = (wins / total * 100) if total > 0 else 0
    total_pnl = sum(pnl_values)

    best = max(pnl_values) if pnl_values else 0
    worst = min(pnl_values) if pnl_values else 0

    # Find best/worst trade symbols
    best_trade = worst_trade = None
    for t in trades:
        p = t.get("pnl")
        if p is not None:
            pf = float(p)
            if pf == best and best_trade is None:
                best_trade = t
            if pf == worst and worst_trade is None:
                worst_trade = t

    lines = [
        f"📊 *PnL Summary (Last {days} days)*",
        f"",
        f"Total trades: {total}",
        f"Wins: {wins}  |  Losses: {losses}",
        f"Win rate: {win_rate:.1f}%",
        f"Total PnL: {fmt_currency(total_pnl)}",
        f"",
        f"Best: {fmt_currency(best)} ({best_trade.get('symbol', '?') if best_trade else '?'})",
        f"Worst: {fmt_currency(worst)} ({worst_trade.get('symbol', '?') if worst_trade else '?'})",
    ]

    # Per-day breakdown
    by_day: dict[str, dict[str, Any]] = {}
    for t in trades:
        day = t.get("entry_time", "unknown")[:10]
        if day not in by_day:
            by_day[day] = {"pnl": 0.0, "count": 0}
        p = t.get("pnl")
        if p is not None:
            by_day[day]["pnl"] += float(p)
        by_day[day]["count"] += 1

    if by_day:
        lines.append("")
        lines.append("*Per-day breakdown:*")
        for day in sorted(by_day.keys()):
            d = by_day[day]
            lines.append(
                f"  {fmt_date(day)}: {d['count']} trades  {fmt_currency(d['pnl'])}"
            )

    return "\n".join(lines)


def format_journal_summary(journal: dict | list, today: str) -> str:
    """Format a journal entry for Telegram."""
    # Backend might return a dict or a list with one item
    if isinstance(journal, list):
        journal = journal[0] if journal else {}

    if not journal:
        return "No journal entry for today."

    lines = [f"📖 *Journal — {fmt_date(today)}*\n"]

    if journal.get("pre_market_notes"):
        lines.append("*Pre-Market:*")
        lines.append(journal["pre_market_notes"])
        lines.append("")

    if journal.get("post_market_notes"):
        lines.append("*Post-Market:*")
        lines.append(journal["post_market_notes"])
        lines.append("")

    if journal.get("mood"):
        lines.append(f"Mood: {journal['mood']}/10")

    if journal.get("lessons_learned"):
        lines.append(f"\nLessons: {journal['lessons_learned']}")

    return "\n".join(lines)


def format_setup_leaderboard(setup_perf: dict, setups: list[dict]) -> str:
    """Format setup performance as a leaderboard."""
    if not setup_perf:
        return "🎯 *Setup Leaderboard*\n\nNo setup data available yet."

    items: list[tuple[str, dict]] = []
    for name, stats in setup_perf.items():
        pnl = stats.get("total_pnl", "0")
        try:
            pnl_float = float(pnl) if isinstance(pnl, str) else float(pnl)
        except (ValueError, TypeError):
            pnl_float = 0.0
        items.append((name, {"**pnl": pnl_float, **stats}))

    # Sort by total PnL descending
    items.sort(key=lambda x: x[1]["**pnl"], reverse=True)

    lines = ["🎯 *Setup Leaderboard*\n"]
    for rank, (name, stats) in enumerate(items, 1):
        pnl_str = fmt_currency(stats["**pnl"])
        count = stats.get("count", 0)
        win_rate = stats.get("win_rate", "N/A")
        emoji = "🥇" if rank == 1 else "🥈" if rank == 2 else "🥉" if rank == 3 else f"{rank}."
        lines.append(
            f"{emoji} *{name}* — {pnl_str}\n"
            f"   {count} trades  |  WR: {win_rate}"
        )

    return "\n".join(lines)


def format_open_trades(trades: list[dict]) -> str:
    """Format open trades list for stop reminders."""
    if not trades:
        return "No open trades. All reviewed. ✅"

    lines = ["⏰ *Open Trades — Stop Check*\n"]
    for t in trades:
        symbol = t.get("symbol", "?")
        direction = t.get("direction", "?")
        entry = t.get("entry_price", "?")
        stop = t.get("stop_price")
        current_note = t.get("notes", "")
        dir_emoji = "🟢" if direction == "LONG" else "🔴"

        lines.append(f"{dir_emoji} *{symbol}*")
        lines.append(f"  Entry: ₹{entry}")
        if stop:
            lines.append(f"  Stop: ₹{stop}")
            try:
                risk = abs(float(entry) - float(stop))
                risk_pct = (risk / float(entry)) * 100 if float(entry) > 0 else 0
                lines.append(f"  Risk: ₹{risk:.2f} ({risk_pct:.1f}%)")
            except (ValueError, TypeError):
                pass
        if current_note:
            lines.append(f"  Notes: {current_note}")
        lines.append("")

    lines.append("Check your stops! 🔍")
    return "\n".join(lines)


# ─── Scheduled job helpers ─────────────────────────────

async def send_daily_pnl_summary(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send daily PnL summary at market close."""
    client = BackendClient()
    today = datetime.now(IST).strftime("%Y-%m-%d")

    try:
        trades = await client.list_trades(limit=500, status="reviewed", to_date=today)
    except Exception as exc:
        logger.error("daily_pnl_fetch_failed", error=str(exc))
        if context.bot:
            await context.bot.send_message(
                chat_id=_get_chat_id(context),
                text="⚠️ Could not fetch today's PnL data.",
            )
        return

    # Filter today's trades
    today_trades = [
        t for t in trades
        if t.get("entry_time", "")[:10] == today
    ]

    if not today_trades:
        msg = "📊 *Market Close Summary*\n\nNo trades today. Clean slate. 🧘"
    else:
        msg = format_pnl_report(today_trades, days=1)
        msg = "📊 *Market Close Summary*\n\n" + msg.split("\n", 1)[1] if "\n" in msg else msg

    from config import CHAT_ID
    if context.bot and CHAT_ID:
        try:
            await context.bot.send_message(
                chat_id=int(CHAT_ID),
                text=msg,
                parse_mode="Markdown",
            )
        except Exception as exc:
            logger.error("daily_pnl_send_failed", error=str(exc))


async def send_stop_reminders(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send periodic reminder to check stops on open trades."""
    client = BackendClient()

    try:
        open_trades = await client.list_open_trades()
    except Exception as exc:
        logger.error("stop_reminder_fetch_failed", error=str(exc))
        return

    if not open_trades:
        return  # Silent skip — no open trades, no noise

    msg = format_open_trades(open_trades)

    from config import CHAT_ID
    if context.bot and CHAT_ID:
        try:
            await context.bot.send_message(
                chat_id=int(CHAT_ID),
                text=msg,
                parse_mode="Markdown",
            )
        except Exception as exc:
            logger.error("stop_reminder_send_failed", error=str(exc))


def _get_chat_id(context: ContextTypes.DEFAULT_TYPE) -> int | None:
    """Resolve chat_id from context or config."""
    from config import CHAT_ID
    if CHAT_ID:
        return int(CHAT_ID)
    if context.job and context.job.chat:
        return context.job.chat.id
    return None
