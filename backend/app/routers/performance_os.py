from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta, datetime
from typing import Optional
from decimal import Decimal
import calendar

from app.db.database import get_db
from app.models.performance_os import DailyWorkflow, WeeklyReview, MonthlyReview
from app.models.trade import Trade
from app.models.daily_journal import DailyJournal
from app.models.emotion_log import EmotionLog
from app.models.execution_grade import ExecutionGrade
from app.models.market_snapshot import MarketSnapshot
from app.schemas.performance_os import (
    DailyWorkflowCreate, DailyWorkflowUpdate, DailyWorkflowResponse,
    DailyWorkflowDashboardResponse,
    WeeklyReviewCreate, WeeklyReviewUpdate, WeeklyReviewResponse,
    WeeklyReviewDetailResponse,
    MonthlyReviewCreate, MonthlyReviewUpdate, MonthlyReviewResponse,
    MonthlyReviewDetailResponse,
    ChecklistItem,
)
from app.utils.logging import get_logger
from app.utils.calculations import compute_aggregate_kpis
from app.core.dependencies import get_current_user

logger = get_logger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/perf-os", tags=["performance-os"])


DEFAULT_PRE_MARKET_CHECKLIST: list[dict] = [
    {"id": "market_trend", "label": "Check market trend (Nifty/BankNifty)", "checked": False},
    {"id": "fii_dii", "label": "Review FII/DII flows", "checked": False},
    {"id": "vix_check", "label": "Check India VIX level", "checked": False},
    {"id": "earnings_calendar", "label": "Review earnings calendar", "checked": False},
    {"id": "watchlist_setup", "label": "Prepare watchlist with setups", "checked": False},
    {"id": "risk_plan", "label": "Set max risk per trade & daily loss limit", "checked": False},
    {"id": "trade_plan", "label": "Write trade plan (entries, exits, SLs)", "checked": False},
    {"id": "mental_check", "label": "Mental state check (calm, focused)", "checked": False},
]


def _get_or_create_workflow(db: Session, d: date) -> DailyWorkflow:
    wf = db.query(DailyWorkflow).filter(DailyWorkflow.date == d).first()
    if wf is None:
        wf = DailyWorkflow(
            date=d,
            phase="pre_market",
            checklist_items=[ChecklistItem(**c).model_dump() for c in DEFAULT_PRE_MARKET_CHECKLIST],
            watchlist_symbols=[],
        )
        db.add(wf)
        db.commit()
        db.refresh(wf)
    return wf


def _today_trades_summary(db: Session, d: date) -> list[dict]:
    day_start = datetime.combine(d, datetime.min.time())
    day_end = day_start + timedelta(days=1)
    trades = db.query(Trade).filter(
        Trade.status != "deleted",
        Trade.entry_time >= day_start,
        Trade.entry_time < day_end,
    ).all()
    return [{
        "id": t.id, "symbol": t.symbol, "entry_price": str(t.entry_price),
        "exit_price": str(t.exit_price) if t.exit_price else None,
        "quantity": str(t.quantity), "pnl": str(t.pnl) if t.pnl else None,
        "setup": t.setup, "exit_reason": t.exit_reason,
    } for t in trades]


def _open_positions(db: Session) -> list[dict]:
    trades = db.query(Trade).filter(Trade.exit_price.is_(None), Trade.status != "deleted").all()
    return [{
        "id": t.id, "symbol": t.symbol, "entry_price": str(t.entry_price),
        "quantity": str(t.quantity), "stop_price": str(t.stop_price) if t.stop_price else None,
        "target_price": str(t.target_price) if t.target_price else None,
        "setup": t.setup, "entry_time": t.entry_time.isoformat() if t.entry_time else None,
    } for t in trades]


def _phase_progress(wf: DailyWorkflow) -> dict:
    phases = ["pre_market", "execution", "review", "behavior"]
    current_idx = phases.index(wf.phase) if wf.phase in phases else 0
    return {
        "current_phase": wf.phase,
        "current_index": current_idx,
        "phases": phases,
        "completed": [wf.pre_market_done, wf.execution_done, wf.review_done, wf.behavior_done],
        "all_done": all([wf.pre_market_done, wf.execution_done, wf.review_done, wf.behavior_done]),
    }


# ────────────────────────── Daily Workflow ──────────────────────────

@router.get("/workflow/today", response_model=DailyWorkflowDashboardResponse)
def get_today_dashboard(db: Session = Depends(get_db)):
    today = date.today()
    wf = _get_or_create_workflow(db, today)
    journal = db.query(DailyJournal).filter(DailyJournal.date == today).first()
    regime = db.query(MarketSnapshot).filter(MarketSnapshot.date == today).first()

    return DailyWorkflowDashboardResponse(
        workflow=DailyWorkflowResponse.model_validate(wf),
        today_trades=_today_trades_summary(db, today),
        open_positions=_open_positions(db),
        market_regime={
            "nifty_close": str(regime.nifty_close) if regime and regime.nifty_close else None,
            "nifty_trend": regime.nifty_trend if regime else None,
            "nifty_regime": regime.nifty_regime if regime else None,
            "india_vix": str(regime.india_vix) if regime and regime.india_vix else None,
            "advance_count": regime.advance_count if regime else None,
            "decline_count": regime.decline_count if regime else None,
        } if regime else None,
        journal={
            "id": journal.id, "mood_rating": journal.mood_rating,
            "discipline_rating": journal.discipline_rating,
            "rules_followed": journal.rules_followed,
            "rules_violated": journal.rules_violated,
        } if journal else None,
        discipline_score=_compute_discipline(db, today),
        phase_progress=_phase_progress(wf),
    )


@router.get("/workflow/{d}", response_model=DailyWorkflowDashboardResponse)
def get_workflow_by_date(d: date, db: Session = Depends(get_db)):
    wf = _get_or_create_workflow(db, d)
    journal = db.query(DailyJournal).filter(DailyJournal.date == d).first()
    regime = db.query(MarketSnapshot).filter(MarketSnapshot.date == d).first()

    return DailyWorkflowDashboardResponse(
        workflow=DailyWorkflowResponse.model_validate(wf),
        today_trades=_today_trades_summary(db, d),
        open_positions=_open_positions(db),
        market_regime={
            "nifty_close": str(regime.nifty_close) if regime and regime.nifty_close else None,
            "nifty_trend": regime.nifty_trend if regime else None,
            "nifty_regime": regime.nifty_regime if regime else None,
            "india_vix": str(regime.india_vix) if regime and regime.india_vix else None,
        } if regime else None,
        journal={
            "id": journal.id,
            "mood_rating": journal.mood_rating,
            "discipline_rating": journal.discipline_rating,
            "rules_followed": journal.rules_followed,
            "rules_violated": journal.rules_violated,
        } if journal else None,
        discipline_score=_compute_discipline(db, d),
        phase_progress=_phase_progress(wf),
    )


@router.put("/workflow/{d}", response_model=DailyWorkflowResponse)
def update_workflow(d: date, payload: DailyWorkflowUpdate, db: Session = Depends(get_db)):
    wf = _get_or_create_workflow(db, d)
    update_data = payload.model_dump(exclude_unset=True)
    if "checklist_items" in update_data and update_data["checklist_items"] is not None:
        update_data["checklist_items"] = [
            c.model_dump() if isinstance(c, ChecklistItem) else c for c in update_data["checklist_items"]
        ]
    for k, v in update_data.items():
        setattr(wf, k, v)
    db.commit()
    db.refresh(wf)
    return DailyWorkflowResponse.model_validate(wf)


@router.post("/workflow/{d}/advance", response_model=DailyWorkflowResponse)
def advance_phase(d: date, db: Session = Depends(get_db)):
    wf = _get_or_create_workflow(db, d)
    phases = ["pre_market", "execution", "review", "behavior"]
    phase_done_map = {
        "pre_market": "pre_market_done",
        "execution": "execution_done",
        "review": "review_done",
        "behavior": "behavior_done",
    }
    current = phases.index(wf.phase) if wf.phase in phases else 0
    setattr(wf, phase_done_map[wf.phase], True)
    if current < len(phases) - 1:
        wf.phase = phases[current + 1]
    else:
        wf.phase = "behavior"
    db.commit()
    db.refresh(wf)
    return DailyWorkflowResponse.model_validate(wf)


@router.post("/workflow/{d}/reset", response_model=DailyWorkflowResponse)
def reset_workflow(d: date, db: Session = Depends(get_db)):
    wf = _get_or_create_workflow(db, d)
    wf.phase = "pre_market"
    wf.pre_market_done = False
    wf.execution_done = False
    wf.review_done = False
    wf.behavior_done = False
    wf.checklist_items = [ChecklistItem(**c).model_dump() for c in DEFAULT_PRE_MARKET_CHECKLIST]
    db.commit()
    db.refresh(wf)
    return DailyWorkflowResponse.model_validate(wf)


def _compute_discipline(db: Session, d: date) -> Optional[dict]:
    from datetime import timedelta
    lookback = d - timedelta(days=30)
    grade_rows = db.query(ExecutionGrade).join(Trade).filter(
        Trade.status != "deleted",
        Trade.entry_time >= lookback,
    ).all()
    if not grade_rows:
        return None
    grade_map = {"A": 4, "B": 3, "C": 2, "D": 1, "F": 0}
    grades = [grade_map[g.overall_grade] for g in grade_rows if g.overall_grade and g.overall_grade in grade_map]
    if not grades:
        return None
    avg = sum(grades) / len(grades)
    return {"avg_execution_grade": round(avg, 2), "total_graded": len(grades)}


# ────────────────────────── Weekly Review ──────────────────────────

def _week_range(d: date) -> tuple[date, date]:
    start = d - timedelta(days=d.weekday())
    end = start + timedelta(days=4)
    return start, end


@router.get("/weekly/current", response_model=WeeklyReviewDetailResponse)
def get_current_weekly_review(db: Session = Depends(get_db)):
    today = date.today()
    week_start, week_end = _week_range(today)
    review = db.query(WeeklyReview).filter(WeeklyReview.week_start == week_start).first()
    if review is None:
        review = WeeklyReview(week_start=week_start, week_end=week_end)
        db.add(review)
        db.commit()
        db.refresh(review)
    return _enrich_weekly(db, review)


@router.get("/weekly/{week_start}", response_model=WeeklyReviewDetailResponse)
def get_weekly_review(week_start: date, db: Session = Depends(get_db)):
    review = db.query(WeeklyReview).filter(WeeklyReview.week_start == week_start).first()
    if review is None:
        week_end = week_start + timedelta(days=4)
        review = WeeklyReview(week_start=week_start, week_end=week_end)
        db.add(review)
        db.commit()
        db.refresh(review)
    return _enrich_weekly(db, review)


@router.put("/weekly/{week_start}", response_model=WeeklyReviewResponse)
def update_weekly_review(week_start: date, payload: WeeklyReviewUpdate, db: Session = Depends(get_db)):
    review = db.query(WeeklyReview).filter(WeeklyReview.week_start == week_start).first()
    if review is None:
        raise HTTPException(404, "Weekly review not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(review, k, v)
    review.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(review)
    return WeeklyReviewResponse.model_validate(review)


from decimal import Decimal

def _enrich_weekly(db: Session, review: WeeklyReview) -> WeeklyReviewDetailResponse:
    week_end_dt = datetime.combine(review.week_end, datetime.max.time())
    week_start_dt = datetime.combine(review.week_start, datetime.min.time())
    trades = db.query(Trade).filter(
        Trade.status != "deleted",
        Trade.entry_time >= week_start_dt,
        Trade.entry_time <= week_end_dt,
    ).all()
    closed = [t for t in trades if t.exit_price is not None]
    wins = [t for t in closed if t.pnl and t.pnl > 0]
    total_pnl = sum(t.pnl or Decimal("0") for t in closed)
    win_rate = len(wins) / len(closed) if closed else 0

    update_data = {
        "total_trades": len(trades), "total_pnl": f"{total_pnl:.2f}",
        "win_rate": f"{win_rate:.1%}" if closed else None,
    }
    if closed:
        best = max(closed, key=lambda t: t.pnl or Decimal("0"))
        worst = min(closed, key=lambda t: t.pnl or Decimal("0"))
        update_data["best_trade_id"] = best.id
        update_data["worst_trade_id"] = worst.id
        setups = {}
        for t in closed:
            s = t.setup or "Unknown"
            setups[s] = setups.get(s, 0) + 1
        if setups:
            update_data["top_setup"] = max(setups, key=setups.get)

    for k, v in update_data.items():
        setattr(review, k, v)
    db.commit()
    db.refresh(review)

    best_trade = None
    if review.best_trade_id:
        bt = db.query(Trade).get(review.best_trade_id)
        if bt:
            best_trade = {"id": bt.id, "symbol": bt.symbol, "pnl": str(bt.pnl)}
    worst_trade = None
    if review.worst_trade_id:
        wt = db.query(Trade).get(review.worst_trade_id)
        if wt:
            worst_trade = {"id": wt.id, "symbol": wt.symbol, "pnl": str(wt.pnl)}

    daily_breakdown = []
    for offset in range(5):
        day = review.week_start + timedelta(days=offset)
        day_trades = [t for t in trades if t.entry_time and t.entry_time.date() == day]
        day_pnl = sum(t.pnl or Decimal("0") for t in day_trades if t.exit_price)
        daily_breakdown.append({"date": day.isoformat(), "trades": len(day_trades), "pnl": f"{day_pnl:.2f}"})

    return WeeklyReviewDetailResponse(
        **WeeklyReviewResponse.model_validate(review).model_dump(),
        best_trade=best_trade,
        worst_trade=worst_trade,
        daily_breakdown=daily_breakdown,
        setup_breakdown=[],
    )


# ────────────────────────── Monthly Review ──────────────────────────

@router.get("/monthly/current", response_model=MonthlyReviewDetailResponse)
def get_current_monthly_review(db: Session = Depends(get_db)):
    month = date.today().strftime("%Y-%m")
    review = db.query(MonthlyReview).filter(MonthlyReview.month == month).first()
    if review is None:
        review = MonthlyReview(month=month)
        db.add(review)
        db.commit()
        db.refresh(review)
    return _enrich_monthly(db, review)


@router.get("/monthly/{month}", response_model=MonthlyReviewDetailResponse)
def get_monthly_review(month: str, db: Session = Depends(get_db)):
    review = db.query(MonthlyReview).filter(MonthlyReview.month == month).first()
    if review is None:
        review = MonthlyReview(month=month)
        db.add(review)
        db.commit()
        db.refresh(review)
    return _enrich_monthly(db, review)


@router.put("/monthly/{month}", response_model=MonthlyReviewResponse)
def update_monthly_review(month: str, payload: MonthlyReviewUpdate, db: Session = Depends(get_db)):
    review = db.query(MonthlyReview).filter(MonthlyReview.month == month).first()
    if review is None:
        raise HTTPException(404, "Monthly review not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(review, k, v)
    review.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(review)
    return MonthlyReviewResponse.model_validate(review)


def _enrich_monthly(db: Session, review: MonthlyReview) -> MonthlyReviewDetailResponse:
    try:
        year, mon = map(int, review.month.split("-"))
        month_start = date(year, mon, 1)
        month_end = date(year, mon, calendar.monthrange(year, mon)[1])
    except (ValueError, IndexError):
        month_start = date.today().replace(day=1)
        month_end = date.today()

    start_dt = datetime.combine(month_start, datetime.min.time())
    end_dt = datetime.combine(month_end, datetime.max.time())
    trades = db.query(Trade).filter(
        Trade.status != "deleted",
        Trade.entry_time >= start_dt,
        Trade.entry_time <= end_dt,
    ).all()
    closed = [t for t in trades if t.exit_price is not None]
    kpis = compute_aggregate_kpis(closed)
    total_pnl = kpis["net_pnl"] or 0
    win_rate = kpis["win_rate"]
    profit_factor = kpis["profit_factor"]
    avg_r = kpis["avg_r"]

    setups = {}
    for t in closed:
        s = t.setup or "Unknown"
        if s not in setups:
            setups[s] = {"pnl": Decimal("0"), "count": 0}
        setups[s]["pnl"] += t.pnl or Decimal("0")
        setups[s]["count"] += 1
    best_setup = max(setups, key=lambda s: setups[s]["pnl"]) if setups else None
    worst_setup = min(setups, key=lambda s: setups[s]["pnl"]) if setups else None

    review.total_trades = len(trades)
    review.total_pnl = f"{total_pnl:.2f}"
    review.win_rate = f"{win_rate / 100:.1%}" if win_rate is not None else None
    review.profit_factor = f"{profit_factor:.2f}" if profit_factor is not None else None
    review.avg_r = f"{avg_r:.2f}" if avg_r is not None else None
    if best_setup:
        review.best_setup = best_setup
    if worst_setup and worst_setup != best_setup:
        review.worst_setup = worst_setup
    db.commit()
    db.refresh(review)

    weekly_reviews = db.query(WeeklyReview).filter(
        WeeklyReview.week_start >= month_start,
        WeeklyReview.week_start <= month_end,
    ).all()

    emotion_q = db.query(EmotionLog).join(Trade).filter(
        Trade.status != "deleted",
        Trade.entry_time >= start_dt,
        Trade.entry_time <= end_dt,
    ).all()
    emotion_counts = {}
    for e in emotion_q:
        emotion_counts[e.emotion] = emotion_counts.get(e.emotion, 0) + 1
    top_emotions = sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    setup_perf = [{"setup": s, "count": d["count"], "pnl": f"{d['pnl']:.2f}"} for s, d in setups.items()]

    return MonthlyReviewDetailResponse(
        **MonthlyReviewResponse.model_validate(review).model_dump(),
        weekly_summaries=[{"week_start": wr.week_start.isoformat(), "total_trades": wr.total_trades, "total_pnl": wr.total_pnl} for wr in weekly_reviews],
        top_emotions=[{"emotion": e, "count": c} for e, c in top_emotions],
        setup_performance=setup_perf,
    )
