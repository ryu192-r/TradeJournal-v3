from __future__ import annotations

import calendar as calendar_lib
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.daily_journal import DailyJournal
from app.models.emotion_log import EmotionLog
from app.models.performance_os import DailyWorkflow
from app.models.trade import Trade
from app.core.dependencies import get_current_user


router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/calendar", tags=["calendar"])


def _parse_month(month: str) -> tuple[date, date]:
    try:
        year, mon = map(int, month.split("-"))
        start = date(year, mon, 1)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="month must use YYYY-MM format")
    end = date(year, mon, calendar_lib.monthrange(year, mon)[1])
    return start, end


def _date_range(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def _money(value: Decimal | int | float | None) -> str:
    return f"{Decimal(value or 0):.2f}"


def _journal_done(journal: DailyJournal | None) -> bool:
    if journal is None:
        return False
    return any([
        journal.pre_trade_notes,
        journal.post_trade_notes,
        journal.mood_rating,
        journal.discipline_rating,
        journal.rules_followed,
        journal.rules_violated,
        journal.lessons_learned,
    ])


def _workflow_done(workflow: DailyWorkflow | None) -> bool:
    if workflow is None:
        return False
    return all([
        workflow.pre_market_done,
        workflow.execution_done,
        workflow.review_done,
        workflow.behavior_done,
    ])


def _day_warnings(trades: list[Trade], journal: DailyJournal | None, emotions: list[EmotionLog]) -> list[str]:
    warnings: list[str] = []
    if len(trades) >= 5:
        warnings.append("overtrading")
    if any(e.emotion in {"revenge", "fomo", "euphoric"} for e in emotions):
        warnings.append("emotional-trading")
    if journal and journal.rules_violated:
        warnings.append("rule-violation")
    return warnings


@router.get("/month")
def get_calendar_month(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    month_start, month_end = _parse_month(month)
    start_dt = datetime.combine(month_start, time.min)
    end_dt = datetime.combine(month_end, time.max)

    trades = (
        db.query(Trade)
        .filter(Trade.status != "deleted", Trade.entry_time >= start_dt, Trade.entry_time <= end_dt)
        .order_by(Trade.entry_time.asc())
        .all()
    )
    trade_ids = [t.id for t in trades]
    emotions = (
        db.query(EmotionLog)
        .filter(EmotionLog.trade_id.in_(trade_ids))
        .order_by(EmotionLog.timestamp.asc())
        .all()
        if trade_ids
        else []
    )
    journals = db.query(DailyJournal).filter(DailyJournal.date >= month_start, DailyJournal.date <= month_end).all()
    workflows = db.query(DailyWorkflow).filter(DailyWorkflow.date >= month_start, DailyWorkflow.date <= month_end).all()

    trades_by_day: dict[date, list[Trade]] = defaultdict(list)
    for trade in trades:
        if trade.entry_time:
            trades_by_day[trade.entry_time.date()].append(trade)

    emotions_by_trade: dict[int, list[EmotionLog]] = defaultdict(list)
    for emotion in emotions:
        emotions_by_trade[emotion.trade_id].append(emotion)

    journals_by_day = {j.date: j for j in journals}
    workflows_by_day = {w.date: w for w in workflows}
    days = []

    for current in _date_range(month_start, month_end):
        day_trades = trades_by_day.get(current, [])
        closed = [t for t in day_trades if t.exit_price is not None]
        wins = [t for t in closed if Decimal(t.pnl or 0) > 0]
        net_pnl = sum((Decimal(t.pnl or 0) for t in closed), Decimal("0"))
        day_emotions = [emotion for trade in day_trades for emotion in emotions_by_trade.get(trade.id, [])]
        journal = journals_by_day.get(current)
        workflow = workflows_by_day.get(current)

        days.append({
            "date": current.isoformat(),
            "trade_count": len(day_trades),
            "closed_count": len(closed),
            "net_pnl": _money(net_pnl),
            "win_rate": round((len(wins) / len(closed)) * 100, 2) if closed else None,
            "discipline_rating": journal.discipline_rating if journal else workflow.discipline_rating if workflow else None,
            "discipline_score": (journal.discipline_rating * 20) if journal and journal.discipline_rating else None,
            "journal_done": _journal_done(journal),
            "workflow_done": _workflow_done(workflow),
            "workflow_phase": workflow.phase if workflow else None,
            "warnings": _day_warnings(day_trades, journal, day_emotions),
            "trades": [
                {
                    "id": t.id,
                    "symbol": t.symbol,
                    "setup": t.setup,
                    "entry_time": t.entry_time.isoformat() if t.entry_time else None,
                    "exit_time": t.exit_time.isoformat() if t.exit_time else None,
                    "entry_price": str(t.entry_price),
                    "exit_price": str(t.exit_price) if t.exit_price is not None else None,
                    "quantity": str(t.quantity),
                    "pnl": str(t.pnl) if t.pnl is not None else None,
                    "chart_image_count": len(t.chart_images or []),
                }
                for t in day_trades
            ],
            "journal": {
                "pre_trade_notes": journal.pre_trade_notes,
                "post_trade_notes": journal.post_trade_notes,
                "mood_rating": journal.mood_rating,
                "discipline_rating": journal.discipline_rating,
                "rules_followed": journal.rules_followed,
                "rules_violated": journal.rules_violated,
                "lessons_learned": journal.lessons_learned,
            } if journal else None,
            "emotions": [
                {
                    "id": e.id,
                    "trade_id": e.trade_id,
                    "emotion": e.emotion,
                    "confidence": e.confidence,
                    "stress": e.stress,
                    "note": e.note,
                    "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                }
                for e in day_emotions
            ],
            "ai_summary": None,
        })

    closed_month_trades = [t for t in trades if t.exit_price is not None]
    month_pnl = sum((Decimal(t.pnl or 0) for t in closed_month_trades), Decimal("0"))
    journal_days = sum(1 for day in days if day["journal_done"])
    warning_days = sum(1 for day in days if day["warnings"])

    return {
        "month": month,
        "summary": {
            "trade_count": len(trades),
            "closed_count": len(closed_month_trades),
            "net_pnl": _money(month_pnl),
            "journal_days": journal_days,
            "warning_days": warning_days,
        },
        "days": days,
    }
