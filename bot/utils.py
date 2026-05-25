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


def fmt_currency(value: float | Decimal | str | None, compact: bool = False) -> str:
    """Format a monetary value as ₹ with sign."""
    if value is None:
        return "₹0"
    try:
        val = float(value)
    except (ValueError, TypeError):
        return "₹0"
    sign = "+" if val >= 0 else "-"
    abs_val = abs(val)
    if compact:
        if abs_val >= 1_00_00_000:
            return f"{sign}₹{abs_val/1_00_00_000:.2f}Cr"
        if abs_val >= 1_00_000:
            return f"{sign}₹{abs_val/1_00_000:.2f}L"
        if abs_val >= 1_000:
            return f"{sign}₹{abs_val/1_000:.1f}k"
        return f"{sign}₹{abs_val:.0f}"
    return f"{sign}₹{abs_val:,.2f}"


def fmt_pct(value: float | None, decimals: int = 1) -> str:
    if value is None:
        return "N/A"
    return f"{value:.{decimals}f}%"


def fmt_date(iso_str: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%d %b")
    except (ValueError, AttributeError):
        return iso_str[:10]


def _pnl_emoji(val: float | None) -> str:
    if val is None:
        return ""
    if val > 0:
        return "🟢"
    if val < 0:
        return "🔴"
    return "⚪"


def _risk_emoji(pct: float | None) -> str:
    if pct is None:
        return "⚪"
    if pct > 6:
        return "🔴"
    if pct > 4:
        return "🟡"
    return "🟢"


# ─── Report formatters ─────────────────────────────────

def format_pnl_report(trades: list[dict], days: int = 7) -> str:
    if not trades:
        return f"📊 *PnL Summary (Last {days} days)*\n\nNo closed trades in this period."

    total = len(trades)
    pnl_values: list[float] = []
    for t in trades:
        p = t.get("pnl")
        if p is not None:
            pnl_values.append(float(p))

    if not pnl_values:
        return f"📊 *PnL Summary (Last {days} days)*\n\nNo PnL data available."

    wins = sum(1 for p in pnl_values if p > 0)
    losses = total - wins
    win_rate = (wins / total * 100) if total > 0 else 0
    total_pnl = sum(pnl_values)
    best = max(pnl_values)
    worst = min(pnl_values)

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
        f"Trades: {total}  |  W: {wins}  L: {losses}",
        f"Win Rate: {win_rate:.1f}%",
        f"Total PnL: {fmt_currency(total_pnl, compact=True)}",
        f"",
        f"Best: {_pnl_emoji(best)} {fmt_currency(best, compact=True)} ({best_trade.get('symbol', '?') if best_trade else '?'})",
        f"Worst: {_pnl_emoji(worst)} {fmt_currency(worst, compact=True)} ({worst_trade.get('symbol', '?') if worst_trade else '?'})",
    ]

    by_day: dict[str, dict[str, Any]] = {}
    for t in trades:
        day = t.get("exit_time") or t.get("entry_time", "unknown")
        if isinstance(day, str):
            day = day[:10]
        else:
            day = "unknown"
        if day not in by_day:
            by_day[day] = {"pnl": 0.0, "count": 0}
        p = t.get("pnl")
        if p is not None:
            by_day[day]["pnl"] += float(p)
        by_day[day]["count"] += 1

    if by_day:
        lines.append("")
        lines.append("*Daily breakdown:*")
        for day in sorted(by_day.keys()):
            d = by_day[day]
            e = _pnl_emoji(d["pnl"])
            lines.append(f"  {fmt_date(day)}: {d['count']}T  {e} {fmt_currency(d['pnl'], compact=True)}")

    return "\n".join(lines)


def format_journal_summary(journal: dict | list, today: str) -> str:
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
    if journal.get("discipline_rating"):
        lines.append(f"Discipline: {journal['discipline_rating']}/5")
    if journal.get("lessons_learned"):
        lines.append(f"\nLessons: {journal['lessons_learned']}")
    return "\n".join(lines)


def format_setup_leaderboard(setup_perf: list[dict]) -> str:
    if not setup_perf:
        return "🎯 *Setup Leaderboard*\n\nNo setup data available yet. Close some trades first!"

    items = []
    for s in setup_perf:
        try:
            pnl_float = float(s.get("total_pnl", 0))
        except (ValueError, TypeError):
            pnl_float = 0.0
        items.append((s.get("setup", "Unknown"), pnl_float, s))

    items.sort(key=lambda x: x[1], reverse=True)

    lines = ["🎯 *Setup Leaderboard*\n"]
    for rank, (name, pnl_float, stats) in enumerate(items[:10], 1):
        count = stats.get("trade_count", 0)
        win_rate = stats.get("win_rate", "N/A")
        avg_r = stats.get("avg_r_multiple")
        pf = stats.get("profit_factor")
        emoji = "🥇" if rank == 1 else "🥈" if rank == 2 else "🥉" if rank == 3 else f"{rank}."
        pnl_str = fmt_currency(pnl_float, compact=True)
        r_str = f"  Avg R: {float(avg_r):.2f}" if avg_r is not None else ""
        pf_str = f"  PF: {float(pf):.1f}" if pf is not None else ""
        lines.append(f"{emoji} *{name}* — _{pnl_str}_")
        lines.append(f"   {count}T  WR: {win_rate}{r_str}{pf_str}")

    return "\n".join(lines)


def format_positions(trades: list[dict], dashboard: dict | None = None) -> str:
    if not trades:
        return "📋 *Open Positions*\n\nNo open positions. You're flat. 🧘"

    live_quotes = {}
    if dashboard:
        for t in dashboard.get("open_trades", []):
            sym = t.get("symbol", "")
            live_quotes[sym] = t

    lines = ["📋 *Open Positions*\n"]
    total_deployed = 0.0
    total_risk = 0.0
    positions_no_sl = 0

    for t in trades:
        symbol = t.get("symbol", "?")
        entry = t.get("entry_price", 0)
        qty = t.get("quantity", 0)
        stop = t.get("stop_price")
        target = t.get("target_price")
        fees = t.get("fees", 0)
        setup = t.get("setup", "")

        try:
            entry_f = float(entry)
            qty_f = float(qty)
            fees_f = float(fees) if fees else 0
        except (ValueError, TypeError):
            continue

        deployed = entry_f * qty_f
        total_deployed += deployed

        risk_str = ""
        if stop:
            try:
                stop_f = float(stop)
                risk_amt = (entry_f - stop_f) * qty_f
                risk_pct = ((entry_f - stop_f) / entry_f) * 100 if entry_f > 0 else 0
                total_risk += risk_amt
                risk_str = f"  Risk: {fmt_currency(risk_amt, compact=True)} ({risk_pct:.1f}%)"
            except (ValueError, TypeError):
                pass
        else:
            positions_no_sl += 1

        lines.append(f"🟢 *{symbol}* ({setup})" if setup else f"🟢 *{symbol}*")
        lines.append(f"  Entry: ₹{entry_f:,.2f}  Qty: {qty_f:.0f}")
        if stop:
            lines.append(f"  SL: ₹{float(stop):,.2f}")
        if target:
            lines.append(f"  TGT: ₹{float(target):,.2f}")
        if risk_str:
            lines.append(risk_str)
        lines.append("")

    summary_lines = [
        f"━" * 20,
        f"Positions: {len(trades)}",
        f"Deployed: {fmt_currency(total_deployed, compact=True)}",
    ]
    if total_risk > 0:
        summary_lines.append(f"Open Risk: {fmt_currency(total_risk, compact=True)}")
    if positions_no_sl > 0:
        summary_lines.append(f"⚠️ {positions_no_sl} without SL!")

    lines.extend(summary_lines)
    return "\n".join(lines)


def format_dashboard(dashboard: dict) -> str:
    if not dashboard:
        return "📊 *Dashboard*\n\nCould not fetch dashboard data."

    kpi = dashboard.get("kpi", {})
    risk = dashboard.get("risk", {})
    capital = dashboard.get("capital", {})
    streaks = dashboard.get("streaks", {})

    lines = ["📊 *Dashboard Snapshot*\n"]

    if kpi:
        tc = kpi.get("trade_count", 0)
        wr = kpi.get("win_rate")
        pf = kpi.get("profit_factor")
        net = kpi.get("net_pnl")
        exp = kpi.get("expectancy")
        avg_r = kpi.get("avg_r_multiple")

        lines.append("*KPIs:*")
        lines.append(f"  Trades: {tc}")
        if wr is not None:
            lines.append(f"  Win Rate: {wr}%")
        if pf is not None:
            lines.append(f"  Profit Factor: {pf}")
        if net is not None:
            lines.append(f"  Net PnL: {fmt_currency(net, compact=True)}")
        if exp is not None:
            lines.append(f"  Expectancy: {fmt_currency(exp, compact=True)}")
        if avg_r is not None:
            lines.append(f"  Avg R: {avg_r}")
        lines.append("")

    if capital:
        ne = capital.get("net_equity")
        ur = capital.get("unrealized_pnl")
        te = capital.get("total_equity_unrealized")
        if ne is not None:
            lines.append(f"💰 Net Equity: ₹{float(ne):,.0f}")
        if ur is not None and float(ur) != 0:
            lines.append(f"📈 Unrealized: {fmt_currency(ur, compact=True)}")
        if te is not None:
            lines.append(f"💎 Total: ₹{float(te):,.0f}")
        lines.append("")

    if risk:
        heat = risk.get("portfolio_heat_pct")
        dep_pct = risk.get("deployed_capital_pct")
        dep = risk.get("deployed_capital")
        avail = risk.get("available_capital")
        no_sl = risk.get("positions_without_stop", 0)
        heat_e = _risk_emoji(heat)
        lines.append(f"⚠️ *Risk:*")
        if dep is not None:
            lines.append(f"  Deployed: ₹{float(dep):,.0f}" + (f" ({dep_pct}%)" if dep_pct else ""))
        if avail is not None:
            lines.append(f"  Available: ₹{float(avail):,.0f}")
        if heat is not None:
            lines.append(f"  Heat: {heat_e} {heat}%")
        if no_sl > 0:
            lines.append(f"  ⚠️ {no_sl} positions without SL!")
        lines.append("")

    if streaks:
        ct = streaks.get("current_type")
        cc = streaks.get("current_count", 0)
        lw = streaks.get("longest_win", 0)
        ll = streaks.get("longest_loss", 0)
        if ct:
            emoji = "🔥" if ct == "win" else "❄️"
            lines.append(f"{emoji} Streak: {cc} {ct}s")
        lines.append(f"  Best win run: {lw}  |  Worst loss run: {ll}")

    warnings = dashboard.get("warnings", [])
    if warnings:
        lines.append("")
        lines.append("⚠️ *Alerts:*")
        for w in warnings[:5]:
            sev = w.get("severity", "medium")
            msg = w.get("message", "")
            e = "🔴" if sev == "high" else "🟡"
            lines.append(f"  {e} {msg}")

    return "\n".join(lines)


def format_risk_summary(dashboard: dict) -> str:
    if not dashboard:
        return "⚠️ *Risk Summary*\n\nCould not fetch risk data."

    risk = dashboard.get("risk", {})
    if not risk:
        return "⚠️ *Risk Summary*\n\nNo risk data available."

    capital = dashboard.get("capital", {})
    warnings = risk.get("warnings", [])

    lines = ["⚠️ *Risk Command Center*\n"]

    ne = risk.get("net_equity")
    if ne:
        lines.append(f"Net Equity: ₹{float(ne):,.0f}")

    dep = risk.get("deployed_capital")
    avail = risk.get("available_capital")
    dep_pct = risk.get("deployed_capital_pct")
    if dep:
        lines.append(f"Deployed: ₹{float(dep):,.0f}" + (f" ({dep_pct}%)" if dep_pct else ""))
    if avail:
        lines.append(f"Available: ₹{float(avail):,.0f}")

    open_risk = risk.get("open_risk")
    heat = risk.get("portfolio_heat_pct")
    heat_e = _risk_emoji(heat)
    if open_risk:
        lines.append(f"Open Risk: ₹{float(open_risk):,.0f}")
    if heat is not None:
        lines.append(f"Portfolio Heat: {heat_e} {heat}%")

    positions = risk.get("open_positions", 0)
    no_sl = risk.get("positions_without_stop", 0)
    lines.append(f"\nOpen Positions: {positions}")
    if no_sl > 0:
        lines.append(f"⚠️ Without Stop Loss: {no_sl}")

    if warnings:
        lines.append("\n*Active Warnings:*")
        for w in warnings:
            sev = w.get("severity", "medium")
            msg = w.get("message", "")
            e = "🔴" if sev == "high" else "🟡"
            lines.append(f"  {e} {msg}")

    return "\n".join(lines)


def format_streaks(dashboard: dict) -> str:
    streaks = dashboard.get("streaks", {})
    if not streaks:
        return "🔥 *Streaks*\n\nNo streak data available."

    ct = streaks.get("current_type")
    cc = streaks.get("current_count", 0)
    lw = streaks.get("longest_win", 0)
    ll = streaks.get("longest_loss", 0)

    lines = ["🔥 *Streaks*\n"]
    if ct:
        emoji = "🔥" if ct == "win" else "❄️"
        lines.append(f"Current: {emoji} {cc} {ct}{'s' if cc > 1 else ''}")
    else:
        lines.append("Current: No active streak")

    lines.append(f"Longest Win: 🔥 {lw}")
    lines.append(f"Longest Loss: ❄️ {ll}")

    return "\n".join(lines)


def format_open_trades(trades: list[dict]) -> str:
    if not trades:
        return "No open trades. All flat. ✅"

    lines = ["⏰ *Open Trades — Stop Check*\n"]
    for t in trades:
        symbol = t.get("symbol", "?")
        entry = t.get("entry_price", "?")
        stop = t.get("stop_price")

        lines.append(f"🟢 *{symbol}*")
        lines.append(f"  Entry: ₹{entry}")
        if stop:
            lines.append(f"  Stop: ₹{stop}")
            try:
                risk = abs(float(entry) - float(stop))
                risk_pct = (risk / float(entry)) * 100 if float(entry) > 0 else 0
                lines.append(f"  Risk: ₹{risk:.2f} ({risk_pct:.1f}%)")
            except (ValueError, TypeError):
                pass
        else:
            lines.append(f"  ⚠️ No stop loss set!")
        lines.append("")

    lines.append("Check your stops! 🔍")
    return "\n".join(lines)


# ─── Scheduled job helpers ─────────────────────────────

async def send_daily_pnl_summary(context: ContextTypes.DEFAULT_TYPE) -> None:
    client = BackendClient()
    today = datetime.now(IST).strftime("%Y-%m-%d")

    try:
        trades = await client.list_trades(limit=500, status="closed", to_date=today)
    except Exception as exc:
        logger.error("daily_pnl_fetch_failed", error=str(exc))
        from config import CHAT_ID
        if context.bot and CHAT_ID:
            await context.bot.send_message(
                chat_id=int(CHAT_ID),
                text="⚠️ Could not fetch today's PnL data.",
            )
        return

    today_trades = [
        t for t in trades
        if (t.get("exit_time") or t.get("entry_time", ""))[:10] == today
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
    client = BackendClient()

    try:
        open_trades = await client.list_open_trades()
    except Exception as exc:
        logger.error("stop_reminder_fetch_failed", error=str(exc))
        return

    if not open_trades:
        return

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
    from config import CHAT_ID
    if CHAT_ID:
        return int(CHAT_ID)
    if context.job and context.job.chat:
        return context.job.chat.id
    return None