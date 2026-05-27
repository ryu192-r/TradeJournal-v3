from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta, datetime, timezone
from typing import Optional
from decimal import Decimal
import calendar

from app.db.database import get_db
from app.models.performance_os import DailyWorkflow, WeeklyReview, MonthlyReview
from app.models.trade import Trade
from app.models.user import User
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


def _get_or_create_workflow(db: Session, d: date, user_id: int) -> DailyWorkflow:
    wf = db.query(DailyWorkflow).filter(DailyWorkflow.date == d, DailyWorkflow.user_id == user_id).first()
    if wf is None:
        wf = DailyWorkflow(
            user_id=user_id,
            date=d,
            phase="pre_market",
            checklist_items=[ChecklistItem(**c).model_dump() for c in DEFAULT_PRE_MARKET_CHECKLIST],
            watchlist_symbols=[],
        )
        db.add(wf)
        db.commit()
        db.refresh(wf)
    return wf


def _today_trades_summary(db: Session, d: date, user_id: int) -> list[dict]:
    day_start = datetime.combine(d, datetime.min.time())
    day_end = day_start + timedelta(days=1)
    trades = db.query(Trade).filter(
        Trade.user_id == user_id,
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


def _open_positions(db: Session, user_id: int) -> list[dict]:
    trades = db.query(Trade).filter(Trade.exit_price.is_(None), Trade.status != "deleted", Trade.user_id == user_id).all()
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
def get_today_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    wf = db.query(DailyWorkflow).filter(DailyWorkflow.date == today, DailyWorkflow.user_id == current_user.id).first()
    if wf is None:
        raise HTTPException(404, "Workflow not found. POST /perf-os/workflow to create one.")
    journal = db.query(DailyJournal).filter(DailyJournal.date == today, DailyJournal.user_id == current_user.id).first()
    regime = db.query(MarketSnapshot).filter(MarketSnapshot.date == today, MarketSnapshot.user_id == current_user.id).first()

    return DailyWorkflowDashboardResponse(
        workflow=DailyWorkflowResponse.model_validate(wf),
        today_trades=_today_trades_summary(db, today, current_user.id),
        open_positions=_open_positions(db, current_user.id),
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
        discipline_score=_compute_discipline(db, today, current_user.id),
        phase_progress=_phase_progress(wf),
    )


@router.get("/workflow/{d}", response_model=DailyWorkflowDashboardResponse)
def get_workflow_by_date(d: date, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wf = db.query(DailyWorkflow).filter(DailyWorkflow.date == d, DailyWorkflow.user_id == current_user.id).first()
    if wf is None:
        raise HTTPException(404, "Workflow not found. POST /perf-os/workflow to create one.")
    journal = db.query(DailyJournal).filter(DailyJournal.date == d, DailyJournal.user_id == current_user.id).first()
    regime = db.query(MarketSnapshot).filter(MarketSnapshot.date == d, MarketSnapshot.user_id == current_user.id).first()

    return DailyWorkflowDashboardResponse(
        workflow=DailyWorkflowResponse.model_validate(wf),
        today_trades=_today_trades_summary(db, d, current_user.id),
        open_positions=_open_positions(db, current_user.id),
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
        discipline_score=_compute_discipline(db, d, current_user.id),
        phase_progress=_phase_progress(wf),
    )


@router.put("/workflow/{d}", response_model=DailyWorkflowResponse)
def update_workflow(d: date, payload: DailyWorkflowUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wf = _get_or_create_workflow(db, d, current_user.id)
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
def advance_phase(d: date, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wf = _get_or_create_workflow(db, d, current_user.id)
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
def reset_workflow(d: date, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wf = _get_or_create_workflow(db, d, current_user.id)
    wf.phase = "pre_market"
    wf.pre_market_done = False
    wf.execution_done = False
    wf.review_done = False
    wf.behavior_done = False
    wf.checklist_items = [ChecklistItem(**c).model_dump() for c in DEFAULT_PRE_MARKET_CHECKLIST]
    db.commit()
    db.refresh(wf)
    return DailyWorkflowResponse.model_validate(wf)


def _compute_discipline(db: Session, d: date, user_id: int) -> Optional[dict]:
    from datetime import timedelta
    lookback = d - timedelta(days=30)
    grade_rows = db.query(ExecutionGrade).join(Trade).filter(
        Trade.user_id == user_id,
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
def get_current_weekly_review(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    week_start, _ = _week_range(today)
    review = db.query(WeeklyReview).filter(WeeklyReview.week_start == week_start, WeeklyReview.user_id == current_user.id).first()
    if review is None:
        raise HTTPException(404, "Weekly review not found. POST /perf-os/enrich/weekly to create one.")
    return _enrich_weekly(db, review, current_user.id)


@router.get("/weekly/{week_start}", response_model=WeeklyReviewDetailResponse)
def get_weekly_review(week_start: date, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    review = db.query(WeeklyReview).filter(WeeklyReview.week_start == week_start, WeeklyReview.user_id == current_user.id).first()
    if review is None:
        raise HTTPException(404, "Weekly review not found. POST /perf-os/enrich/weekly to create one.")
    return _enrich_weekly(db, review, current_user.id)


# ── Enrich endpoints (idempotent create-or-enrich) ──


class EnrichWeeklyRequest(BaseModel):
    week_start: Optional[str] = None


class EnrichMonthlyRequest(BaseModel):
    month: Optional[str] = None


class WorkflowEnsureRequest(BaseModel):
    date: Optional[str] = None


@router.post("/enrich/weekly", response_model=WeeklyReviewDetailResponse, status_code=201)
def enrich_weekly_review(payload: EnrichWeeklyRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.week_start:
        ws = datetime.strptime(payload.week_start, "%Y-%m-%d").date()
    else:
        ws, _ = _week_range(date.today())
    we = ws + timedelta(days=4)
    review = db.query(WeeklyReview).filter(WeeklyReview.week_start == ws, WeeklyReview.user_id == current_user.id).first()
    if review is None:
        review = WeeklyReview(week_start=ws, week_end=we, user_id=current_user.id)
        db.add(review)
        db.commit()
        db.refresh(review)
    return _enrich_weekly(db, review, current_user.id)


@router.post("/enrich/monthly", response_model=MonthlyReviewDetailResponse, status_code=201)
def enrich_monthly_review(payload: EnrichMonthlyRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    mon = payload.month or date.today().strftime("%Y-%m")
    review = db.query(MonthlyReview).filter(MonthlyReview.month == mon, MonthlyReview.user_id == current_user.id).first()
    if review is None:
        review = MonthlyReview(month=mon, user_id=current_user.id)
        db.add(review)
        db.commit()
        db.refresh(review)
    return _enrich_monthly(db, review, current_user.id)


@router.post("/workflow", response_model=DailyWorkflowResponse, status_code=201)
def ensure_workflow(payload: WorkflowEnsureRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.date:
        d = datetime.strptime(payload.date, "%Y-%m-%d").date()
    else:
        d = date.today()
    wf = _get_or_create_workflow(db, d, current_user.id)
    return DailyWorkflowResponse.model_validate(wf)


@router.put("/weekly/{week_start}", response_model=WeeklyReviewResponse)
def update_weekly_review(week_start: date, payload: WeeklyReviewUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    review = db.query(WeeklyReview).filter(WeeklyReview.week_start == week_start, WeeklyReview.user_id == current_user.id).first()
    if review is None:
        raise HTTPException(404, "Weekly review not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(review, k, v)
    review.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(review)
    return WeeklyReviewResponse.model_validate(review)


from decimal import Decimal

def _enrich_weekly(db: Session, review: WeeklyReview, user_id: int) -> WeeklyReviewDetailResponse:
    week_end_dt = datetime.combine(review.week_end, datetime.max.time())
    week_start_dt = datetime.combine(review.week_start, datetime.min.time())
    trades = db.query(Trade).filter(
        Trade.user_id == user_id,
        Trade.status != "deleted",
        Trade.entry_time >= week_start_dt,
        Trade.entry_time <= week_end_dt,
    ).all()
    closed = [t for t in trades if t.exit_price is not None]
    wins = [t for t in closed if t.pnl and t.pnl > 0]
    total_pnl = sum(t.pnl or Decimal("0") for t in closed)
    win_rate = len(wins) / len(closed) if closed else 0

    best_trade = None
    worst_trade = None
    top_setup = None
    if closed:
        best = max(closed, key=lambda t: t.pnl or Decimal("0"))
        worst = min(closed, key=lambda t: t.pnl or Decimal("0"))
        best_trade = {"id": best.id, "symbol": best.symbol, "pnl": str(best.pnl)} if best.pnl else None
        worst_trade = {"id": worst.id, "symbol": worst.symbol, "pnl": str(worst.pnl)} if worst.pnl else None
        setups = {}
        for t in closed:
            s = t.setup or "Unknown"
            setups[s] = setups.get(s, 0) + 1
        if setups:
            top_setup = max(setups, key=setups.get)

    daily_breakdown = []
    for offset in range(5):
        day = review.week_start + timedelta(days=offset)
        day_trades = [t for t in trades if t.entry_time and t.entry_time.date() == day]
        day_pnl = sum(t.pnl or Decimal("0") for t in day_trades if t.exit_price)
        daily_breakdown.append({"date": day.isoformat(), "trades": len(day_trades), "pnl": f"{day_pnl:.2f}"})

    base = WeeklyReviewResponse.model_validate(review).model_dump()
    return WeeklyReviewDetailResponse(
        **{**base, "total_trades": len(trades), "total_pnl": f"{total_pnl:.2f}",
           "win_rate": f"{win_rate:.1%}" if closed else None},
        best_trade=best_trade,
        worst_trade=worst_trade,
        top_setup=top_setup,
        daily_breakdown=daily_breakdown,
        setup_breakdown=[],
    )


# ────────────────────────── Monthly Review ──────────────────────────

@router.get("/monthly/current", response_model=MonthlyReviewDetailResponse)
def get_current_monthly_review(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    month = date.today().strftime("%Y-%m")
    review = db.query(MonthlyReview).filter(MonthlyReview.month == month, MonthlyReview.user_id == current_user.id).first()
    if review is None:
        raise HTTPException(404, "Monthly review not found. POST /perf-os/enrich/monthly to create one.")
    return _enrich_monthly(db, review, current_user.id)


@router.get("/monthly/{month}", response_model=MonthlyReviewDetailResponse)
def get_monthly_review(month: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    review = db.query(MonthlyReview).filter(MonthlyReview.month == month, MonthlyReview.user_id == current_user.id).first()
    if review is None:
        raise HTTPException(404, "Monthly review not found. POST /perf-os/enrich/monthly to create one.")
    return _enrich_monthly(db, review, current_user.id)


@router.put("/monthly/{month}", response_model=MonthlyReviewResponse)
def update_monthly_review(month: str, payload: MonthlyReviewUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    review = db.query(MonthlyReview).filter(MonthlyReview.month == month, MonthlyReview.user_id == current_user.id).first()
    if review is None:
        raise HTTPException(404, "Monthly review not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(review, k, v)
    review.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(review)
    return MonthlyReviewResponse.model_validate(review)


def _enrich_monthly(db: Session, review: MonthlyReview, user_id: int) -> MonthlyReviewDetailResponse:
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
        Trade.user_id == user_id,
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

    weekly_reviews = db.query(WeeklyReview).filter(
        WeeklyReview.week_start >= month_start,
        WeeklyReview.week_start <= month_end,
        WeeklyReview.user_id == user_id,
    ).all()

    emotion_q = db.query(EmotionLog).join(Trade).filter(
        Trade.user_id == user_id,
        Trade.status != "deleted",
        Trade.entry_time >= start_dt,
        Trade.entry_time <= end_dt,
    ).all()
    emotion_counts = {}
    for e in emotion_q:
        emotion_counts[e.emotion] = emotion_counts.get(e.emotion, 0) + 1
    top_emotions = sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    setup_perf = [{"setup": s, "count": d["count"], "pnl": f"{d['pnl']:.2f}"} for s, d in setups.items()]

    base = MonthlyReviewResponse.model_validate(review).model_dump()
    return MonthlyReviewDetailResponse(
        **{**base, "total_trades": len(trades), "total_pnl": f"{total_pnl:.2f}",
           "win_rate": f"{win_rate / 100:.1%}" if win_rate is not None else None,
           "profit_factor": f"{profit_factor:.2f}" if profit_factor is not None else None,
           "avg_r": f"{avg_r:.2f}" if avg_r is not None else None,
           "best_setup": best_setup, "worst_setup": worst_setup},
        weekly_summaries=[{"week_start": wr.week_start.isoformat(), "total_trades": wr.total_trades, "total_pnl": wr.total_pnl} for wr in weekly_reviews],
        top_emotions=[{"emotion": e, "count": c} for e, c in top_emotions],
        setup_performance=setup_perf,
    )
