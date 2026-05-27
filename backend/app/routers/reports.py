from __future__ import annotations

import calendar as calendar_lib
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.daily_journal import DailyJournal
from app.models.emotion_log import EmotionLog
from app.models.trade import Trade
from app.utils.calculations import compute_aggregate_kpis


router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/reports", tags=["reports"])


def _money(value: Decimal | int | float | None) -> str:
    return f"{Decimal(value or 0):.2f}"


def _date_window(start: date, end: date) -> tuple[datetime, datetime]:
    return datetime.combine(start, time.min), datetime.combine(end, time.max)


def _parse_month(month: str) -> tuple[date, date]:
    try:
        year, mon = map(int, month.split("-"))
        start = date(year, mon, 1)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="month must use YYYY-MM format")
    return start, date(year, mon, calendar_lib.monthrange(year, mon)[1])


def _serialise_trade(trade: Trade) -> dict:
    return {
        "id": trade.id,
        "symbol": trade.symbol,
        "setup": trade.setup or "Unassigned",
        "entry_time": trade.entry_time.isoformat() if trade.entry_time else None,
        "exit_time": trade.exit_time.isoformat() if trade.exit_time else None,
        "entry_price": str(trade.entry_price),
        "exit_price": str(trade.exit_price) if trade.exit_price is not None else None,
        "quantity": str(trade.quantity),
        "pnl": str(trade.pnl) if trade.pnl is not None else None,
        "r_multiple": str(trade.r_multiple) if trade.r_multiple is not None else None,
        "exit_reason": trade.exit_reason,
    }


def _report_payload(db: Session, period: str, start: date, end: date) -> dict:
    start_dt, end_dt = _date_window(start, end)
    trades = (
        db.query(Trade)
        .filter(Trade.status != "deleted", Trade.entry_time >= start_dt, Trade.entry_time <= end_dt)
        .order_by(Trade.entry_time.asc())
        .all()
    )
    closed = [trade for trade in trades if trade.exit_price is not None]
    kpis = compute_aggregate_kpis(closed)
    total_pnl = Decimal(kpis["net_pnl"] or 0)
    gross_profit = Decimal(kpis["gross_profit"] or 0)
    gross_loss = Decimal(kpis["gross_loss"] or 0)

    setups: dict[str, dict] = defaultdict(lambda: {"trade_count": 0, "closed_count": 0, "net_pnl": Decimal("0"), "wins": 0})
    days: dict[str, dict] = defaultdict(lambda: {"date": "", "trade_count": 0, "net_pnl": Decimal("0")})
    for trade in trades:
        setup = trade.setup or "Unassigned"
        setups[setup]["trade_count"] += 1
        if trade.exit_price is not None:
            setups[setup]["closed_count"] += 1
            setups[setup]["net_pnl"] += Decimal(trade.pnl or 0)
            if Decimal(trade.pnl or 0) > 0:
                setups[setup]["wins"] += 1
        day_key = trade.entry_time.date().isoformat() if trade.entry_time else start.isoformat()
        days[day_key]["date"] = day_key
        days[day_key]["trade_count"] += 1
        if trade.exit_price is not None:
            days[day_key]["net_pnl"] += Decimal(trade.pnl or 0)

    journals = db.query(DailyJournal).filter(DailyJournal.date >= start, DailyJournal.date <= end).all()
    journal_days = [j for j in journals if any([j.pre_trade_notes, j.post_trade_notes, j.discipline_rating])]
    avg_discipline = None
    discipline_values = [j.discipline_rating for j in journals if j.discipline_rating is not None]
    if discipline_values:
        avg_discipline = round(sum(discipline_values) / len(discipline_values), 2)

    trade_ids = [trade.id for trade in trades]
    emotions = db.query(EmotionLog).filter(EmotionLog.trade_id.in_(trade_ids)).all() if trade_ids else []
    emotion_counts: dict[str, int] = defaultdict(int)
    for emotion in emotions:
        emotion_counts[emotion.emotion] += 1

    setup_report = [
        {
            "setup": setup,
            "trade_count": data["trade_count"],
            "closed_count": data["closed_count"],
            "net_pnl": _money(data["net_pnl"]),
            "win_rate": round((data["wins"] / data["closed_count"]) * 100, 2) if data["closed_count"] else None,
        }
        for setup, data in sorted(setups.items(), key=lambda item: item[1]["net_pnl"], reverse=True)
    ]
    daily_report = [
        {"date": key, "trade_count": data["trade_count"], "net_pnl": _money(data["net_pnl"])}
        for key, data in sorted(days.items())
    ]
    behavior_report = {
        "journal_days": len(journal_days),
        "avg_discipline_rating": avg_discipline,
        "rule_violation_days": sum(1 for j in journals if j.rules_violated),
        "top_emotions": [
            {"emotion": emotion, "count": count}
            for emotion, count in sorted(emotion_counts.items(), key=lambda item: item[1], reverse=True)[:5]
        ],
    }

    return {
        "period": period,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "summary": {
            "trade_count": len(trades),
            "closed_count": len(closed),
            "net_pnl": _money(total_pnl),
            "gross_profit": _money(gross_profit),
            "gross_loss": _money(gross_loss),
            "win_rate": kpis["win_rate"],
            "profit_factor": kpis["profit_factor"],
            "best_trade": _serialise_trade(max(closed, key=lambda trade: Decimal(trade.pnl or 0))) if closed else None,
            "worst_trade": _serialise_trade(min(closed, key=lambda trade: Decimal(trade.pnl or 0))) if closed else None,
        },
        "daily_report": daily_report,
        "setup_report": setup_report,
        "behavior_report": behavior_report,
        "trades": [_serialise_trade(trade) for trade in trades],
        "export_formats": ["json", "csv", "html"],
    }


@router.get("/weekly")
def get_weekly_report(
    week_start: date = Query(...),
    db: Session = Depends(get_db),
):
    return _report_payload(db, "weekly", week_start, week_start + timedelta(days=6))


@router.get("/monthly")
def get_monthly_report(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    start, end = _parse_month(month)
    return _report_payload(db, "monthly", start, end)
