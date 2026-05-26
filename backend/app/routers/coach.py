"""AI Coach router — endpoints for generating and retrieving trading insights."""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

import json
import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.schemas.coach import (
    AskCoachRequest,
    CoachReviewListItem,
    CoachReviewListResponse,
    CoachReviewRequest,
    CoachReviewResponse,
    TradeInsightRequest,
    TradeReviewRequest,
    TradeReviewResponse,
    TradeReviewScores,
    MissedOpportunity,
    WeeklyReviewRequest,
    PatternDetectionRequest,
    PatternDetectionResponse,
    PatternResult,
    RuleReminderRequest,
    RuleReminderResponse,
)
from app.services.ai_coach import ai_coach, review_cache, review_cache_key, trade_to_dict, compute_summary_stats, compute_setup_performance
from app.core.ai_config import get_ai_config
from app.db.database import get_db
from app.models.coach_review import CoachReview
from app.models.emotion_log import EmotionLog
from app.models.execution_grade import ExecutionGrade
from app.models.trade_timeline import TradeTimeline
from app.models.partial_exit import PartialExit
from app.models.setup_playbook import SetupPlaybook
from app.models.trade import Trade
from app.utils.logging import get_logger
from app.core.dependencies import get_current_user

logger = get_logger(__name__)

_now = lambda: datetime.now(timezone.utc)

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/coach", tags=["ai-coach"])

# ──────────────────────── helpers ────────────────────────


def _get_trades_for_period(db: Session, start: datetime, end: datetime) -> List[Trade]:
    """Fetch non-deleted trades within a date range."""
    stmt = (
        select(Trade)
        .where(
            Trade.entry_time >= start,
            Trade.entry_time <= end,
            Trade.status != "deleted",
        )
        .order_by(Trade.entry_time.asc())
    )
    return list(db.scalars(stmt).all())


def _load_lifecycle_for_trades(db: Session, trade_ids: list[int]) -> dict[int, dict]:
    """Bulk-load emotion logs, execution grades, and timeline events for trades."""
    emotions = db.query(EmotionLog).filter(EmotionLog.trade_id.in_(trade_ids)).all()
    grades = db.query(ExecutionGrade).filter(ExecutionGrade.trade_id.in_(trade_ids)).all()
    timelines = db.query(TradeTimeline).filter(TradeTimeline.trade_id.in_(trade_ids)).order_by(TradeTimeline.timestamp.desc()).all()

    result: dict[int, dict] = {tid: {"emotions": [], "grade": None, "timeline": []} for tid in trade_ids}
    for e in emotions:
        result[e.trade_id]["emotions"].append(e)
    for g in grades:
        result[g.trade_id]["grade"] = g
    for t in timelines:
        result[t.trade_id]["timeline"].append(t)
    return result


def _enrich_trades_with_lifecycle(trades: list[Trade], db: Session) -> list[dict]:
    """Convert trades to dicts including lifecycle data for AI context."""
    trade_ids = [t.id for t in trades]
    lifecycle_map = _load_lifecycle_for_trades(db, trade_ids)
    return [trade_to_dict(t, lifecycle=lifecycle_map.get(t.id)) for t in trades]


# ──────────────────────── endpoints ────────────────────────


@router.post(
    "/review/daily",
    response_model=CoachReviewResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"description": "No trades found in period"},
        500: {"description": "AI generation failed"},
    },
)
async def generate_daily_review(
    request: CoachReviewRequest,
    db: Session = Depends(get_db),
) -> CoachReviewResponse:
    """Generate an AI-powered daily review for a period."""
    now = _now()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    period_start = request.period_start or today.replace(
        hour=3, minute=45
    )
    period_end = request.period_end or today.replace(
        hour=10, minute=0
    )

    # Cache check
    trade_ids_str = ",".join(str(i) for i in (request.trade_ids or []))
    cache_key = review_cache_key(
        "daily", period_start.isoformat(), period_end.isoformat(), trade_ids_str
    )

    cached = review_cache.get(cache_key)
    if cached:
        content, trades_count = cached
        return CoachReviewResponse(
            insight=content,
            review_type="daily",
            trades_analyzed=trades_count,
            model_used="cached",
            generated_at=_now().isoformat(),
        )

    # Fetch trades
    trades = _get_trades_for_period(db, period_start, period_end)
    if not trades:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No trades found between {period_start.date()} and {period_end.date()}",
        )

    if request.trade_ids:
        trades = [t for t in trades if t.id in request.trade_ids]
        if not trades:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"None of the requested trade IDs found: {request.trade_ids}",
            )

    trade_data = _enrich_trades_with_lifecycle(trades, db)
    summary_stats = compute_summary_stats(trades)

    try:
        insight = await ai_coach.generate_daily_review(
            trades=trade_data,
            summary_stats=summary_stats,
        )
    except Exception as e:
        logger.error("daily_review_generation_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate review: {str(e)}",
        )

    review_cache.set(cache_key, insight, trades_analyzed=len(trades))

    # Persist in DB
    db_review = CoachReview(
        review_type="daily",
        content=insight,
        period_start=period_start,
        period_end=period_end,
        trade_ids=[t.id for t in trades],
        summary_stats=summary_stats,
        model_used="ollama",
        prompt_template="daily_review",
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)

    logger.info("daily_review_generated", review_id=db_review.id, trade_count=len(trades))

    return CoachReviewResponse(
        insight=insight,
        review_type="daily",
        trades_analyzed=len(trades),
        model_used="ollama",
        generated_at=(
            db_review.created_at.isoformat()
            if db_review.created_at
            else _now().isoformat()
        ),
    )


@router.post(
    "/review/weekly",
    response_model=CoachReviewResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"description": "No trades found in period"},
        500: {"description": "AI generation failed"},
    },
)
async def generate_weekly_review(
    request: WeeklyReviewRequest,
    db: Session = Depends(get_db),
) -> CoachReviewResponse:
    """Generate a weekly performance review."""
    now = _now()
    period_end = request.period_end or now
    period_start = request.period_start or (period_end - timedelta(days=7))

    trades = _get_trades_for_period(db, period_start, period_end)
    if not trades:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No trades found in the week of {period_start.date()}",
        )

    trade_data = _enrich_trades_with_lifecycle(trades, db)
    summary_stats = compute_summary_stats(trades)
    setup_performance = compute_setup_performance(trades)

    cache_key = review_cache_key(
        "weekly", period_start.isoformat(), period_end.isoformat()
    )
    cached = review_cache.get(cache_key)
    if cached:
        content, trades_count = cached
        return CoachReviewResponse(
            insight=content,
            review_type="weekly",
            trades_analyzed=trades_count,
            model_used="cached",
            generated_at=_now().isoformat(),
        )

    try:
        insight = await ai_coach.generate_weekly_review(
            trades=trade_data,
            summary_stats=summary_stats,
            setup_performance=setup_performance,
        )
    except Exception as e:
        logger.error("weekly_review_generation_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate review: {str(e)}",
        )

    review_cache.set(cache_key, insight, trades_analyzed=len(trades))

    db_review = CoachReview(
        review_type="weekly",
        content=insight,
        period_start=period_start,
        period_end=period_end,
        trade_ids=[t.id for t in trades],
        summary_stats=summary_stats,
        model_used="ollama",
        prompt_template="weekly_review",
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)

    return CoachReviewResponse(
        insight=insight,
        review_type="weekly",
        trades_analyzed=len(trades),
        model_used="ollama",
        generated_at=(
            db_review.created_at.isoformat()
            if db_review.created_at
            else _now().isoformat()
        ),
    )


@router.post(
    "/insight",
    response_model=CoachReviewResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        404: {"description": "Trades not found"},
        422: {"description": "Validation error — no trade IDs"},
        500: {"description": "AI generation failed"},
    },
)
async def generate_trade_insight(
    request: TradeInsightRequest,
    db: Session = Depends(get_db),
) -> CoachReviewResponse:
    """Generate one-off analysis for specific trades."""
    stmt = (
        select(Trade)
        .where(
            Trade.id.in_(request.trade_ids),
            Trade.status != "deleted",
        )
    )
    trades = list(db.scalars(stmt).all())
    if not trades:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No valid trades found for IDs: {request.trade_ids}",
        )

    trade_data = _enrich_trades_with_lifecycle(trades, db)

    try:
        insight = await ai_coach.generate_trade_insight(
            trades=trade_data,
            context=request.context or "",
        )
    except Exception as e:
        logger.error("trade_insight_generation_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate insight: {str(e)}",
        )

    db_review = CoachReview(
        review_type="insight",
        content=insight,
        trade_ids=request.trade_ids,
        model_used="ollama",
        prompt_template="trade_insight",
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)

    return CoachReviewResponse(
        insight=insight,
        review_type="insight",
        trades_analyzed=len(trades),
        model_used="ollama",
        generated_at=(
            db_review.created_at.isoformat()
            if db_review.created_at
            else _now().isoformat()
        ),
    )


@router.post(
    "/ask",
    response_model=CoachReviewResponse,
    status_code=status.HTTP_200_OK,
    responses={
        500: {"description": "AI generation failed"},
    },
)
async def ask_coach(
    request: AskCoachRequest,
    db: Session = Depends(get_db),
) -> CoachReviewResponse:
    """Free-form question to the AI coach — 'Ask the Coach' tab."""
    trade_data: list[dict] = []
    summary_stats: dict = {}

    if request.trade_ids:
        stmt = select(Trade).where(Trade.id.in_(request.trade_ids), Trade.status != "deleted")
        trades = list(db.scalars(stmt).all())
        trade_data = _enrich_trades_with_lifecycle(trades, db)
        summary_stats = compute_summary_stats(trades)
    elif request.period_start and request.period_end:
        trades = _get_trades_for_period(db, request.period_start, request.period_end)
        trade_data = _enrich_trades_with_lifecycle(trades, db)
        summary_stats = compute_summary_stats(trades)

    try:
        answer = await ai_coach.ask_coach(
            question=request.question,
            trade_data=trade_data if trade_data else None,
            summary_stats=summary_stats if summary_stats else None,
        )
    except Exception as e:
        logger.error("coach_question_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to answer question: {str(e)}",
        )

    db_review = CoachReview(
        review_type="answer",
        content=answer,
        trade_ids=request.trade_ids or [t["id"] for t in trade_data],
        model_used="ollama",
        prompt_template="ask_coach",
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)

    return CoachReviewResponse(
        insight=answer,
        review_type="answer",
        trades_analyzed=len(trade_data),
        model_used="ollama",
        generated_at=(
            db_review.created_at.isoformat()
            if db_review.created_at
            else _now().isoformat()
        ),
    )


@router.post(
    "/patterns",
    response_model=PatternDetectionResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"description": "No trades found in period"},
        500: {"description": "Pattern detection failed"},
    },
)
async def detect_patterns(
    request: PatternDetectionRequest,
    db: Session = Depends(get_db),
) -> PatternDetectionResponse:
    """Detect recurring behavioral patterns in recent trades."""
    now = _now()
    period_end = now
    period_start = now - timedelta(days=request.lookback_days)

    trades = _get_trades_for_period(db, period_start, period_end)
    if not trades:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No trades found in the last {request.lookback_days} days",
        )

    trade_data = _enrich_trades_with_lifecycle(trades, db)
    summary_stats = compute_summary_stats(trades)

    try:
        raw_patterns = await ai_coach.detect_patterns(
            trades=trade_data,
            summary_stats=summary_stats,
            lookback_days=request.lookback_days,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pattern detection failed: {str(e)}",
        )
    except Exception as e:
        logger.error("pattern_detection_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pattern detection failed: {str(e)}",
        )

    patterns = [
        PatternResult(
            name=p.get("name", "Unknown"),
            severity=p.get("severity", "neutral"),
            description=p.get("description", ""),
            evidence=p.get("evidence", ""),
            suggestion=p.get("suggestion"),
        )
        for p in raw_patterns
    ]

    return PatternDetectionResponse(
        patterns=patterns,
        trades_analyzed=len(trades),
        lookback_days=request.lookback_days,
        model_used="ollama",
        generated_at=_now().isoformat(),
    )


@router.post(
    "/rule-reminders",
    response_model=RuleReminderResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"description": "No trades found in period"},
        500: {"description": "Rule check failed"},
    },
)
async def check_rule_reminders(
    request: RuleReminderRequest,
    db: Session = Depends(get_db),
) -> RuleReminderResponse:
    """Check recent trades against trading rules and generate reminders."""
    now = _now()
    period_end = now
    period_start = now - timedelta(days=request.lookback_days)

    trades = _get_trades_for_period(db, period_start, period_end)
    if not trades:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No trades found in the last {request.lookback_days} days",
        )

    trade_data = _enrich_trades_with_lifecycle(trades, db)

    try:
        reminder = await ai_coach.check_rule_reminders(
            trades=trade_data,
            rules=request.rules,
        )
    except Exception as e:
        logger.error("rule_reminder_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Rule check failed: {str(e)}",
        )

    rules_count = len(request.rules) if request.rules else 5  # 5 default rules

    return RuleReminderResponse(
        reminder=reminder,
        trades_analyzed=len(trades),
        rules_checked=rules_count,
        model_used="ollama",
        generated_at=_now().isoformat(),
    )


@router.get("/reviews", response_model=CoachReviewListResponse)
async def list_reviews(
    review_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> CoachReviewListResponse:
    """List past AI-generated reviews with optional filtering."""
    query = db.query(CoachReview)
    if review_type:
        query = query.filter(CoachReview.review_type == review_type)

    total = query.count()
    reviews = query.order_by(CoachReview.created_at.desc()).offset(skip).limit(limit).all()

    return CoachReviewListResponse(
        total=total,
        items=[
            CoachReviewListItem(
                id=r.id,
                review_type=r.review_type,
                content_preview=r.content[:200] + "..." if len(r.content) > 200 else r.content,
                period_start=r.period_start,
                period_end=r.period_end,
                trades_analyzed=len(r.trade_ids or []),
                model_used=r.model_used or "ollama",
                created_at=r.created_at,
            )
            for r in reviews
        ],
    )


@router.get("/reviews/{review_id}", response_model=CoachReviewResponse)
def get_review(
    review_id: int,
    db: Session = Depends(get_db),
) -> CoachReviewResponse:
    """Get a specific review by ID."""
    review = db.get(CoachReview, review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    return CoachReviewResponse(
        insight=review.content,
        review_type=review.review_type,
        trades_analyzed=len(review.trade_ids or []),
        model_used=review.model_used or "ollama",
        generated_at=(
            review.created_at.isoformat()
            if review.created_at
            else _now().isoformat()
        ),
    )


@router.delete(
    "/reviews/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"description": "Review not found"},
    },
)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
) -> None:
    """Delete a specific review by ID."""
    review = db.get(CoachReview, review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    db.delete(review)
    db.commit()
    logger.info("review_deleted", review_id=review_id)


@router.post(
    "/behavioral-score",
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"description": "No trades found in period"},
        500: {"description": "AI scoring failed"},
    },
)
async def behavioral_score(
    lookback_days: int = 30,
    db: Session = Depends(get_db),
) -> dict:
    """Generate an AI-powered behavioral score with personalized recommendations.

    Combines programmatic discipline metrics with AI-generated insights.
    """
    from app.routers.lifecycle_analytics import composite_discipline_score, _parse_date_range, _base_trade_query

    start, end = _parse_date_range(None, None)
    if not start:
        now = _now()
        start = now - timedelta(days=lookback_days)

    programmatic = composite_discipline_score(
        from_date=start.isoformat(),
        to_date=end.isoformat() if end else None,
        db=db,
    )

    trades = _get_trades_for_period(db, start, end or _now())
    if not trades:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No trades found in the last {lookback_days} days",
        )

    trade_data = _enrich_trades_with_lifecycle(trades, db)
    summary_stats = compute_summary_stats(trades)

    prompt_parts = [
        "You are a trading behavioral analyst. Based on the data below, provide a concise behavioral assessment.",
        "",
        f"DISCIPLINE METRICS (programmatic):",
        f"- Overall score: {programmatic.get('overall_score', 'N/A')}/100",
        f"- Grade: {programmatic.get('grade', 'N/A')}",
    ]
    components = programmatic.get("components", {})
    for comp, score in components.items():
        prompt_parts.append(f"- {comp}: {score}/100")
    prompt_parts.append("")
    prompt_parts.append(f"TRADE SUMMARY: {len(trades)} trades, PnL: {summary_stats.get('total_pnl', 'N/A')}, Win rate: {summary_stats.get('win_rate', 'N/A')}%")
    prompt_parts.append("")
    prompt_parts.append("RECENT TRADES:")
    for td in trade_data[:10]:
        pnl_str = f"PnL: {td.get('pnl', 'N/A')}"
        emotion_str = f"emotion: {td.get('emotions', 'none')}" if td.get('emotions') else ""
        grade_str = f"grade: {td.get('overall_grade', 'N/A')}" if td.get('overall_grade') else ""
        prompt_parts.append(f"  {td.get('symbol', '?')} | {pnl_str} | {emotion_str} | {grade_str}")
    prompt_parts.append("")
    prompt_parts.append("Return JSON with this exact structure:")
    prompt_parts.append('{')
    prompt_parts.append('  "behavioral_summary": "2-3 sentence summary of the trader\'s behavioral patterns",')
    prompt_parts.append('  "strengths": ["list of 2-3 behavioral strengths"],')
    prompt_parts.append('  "weaknesses": ["list of 2-3 behavioral weaknesses"],')
    prompt_parts.append('  "recommendations": ["3-5 specific actionable recommendations"],')
    prompt_parts.append('  "risk_level": "low|medium|high",')
    prompt_parts.append('  "composite_score": <number 0-100 based on overall assessment>')
    prompt_parts.append('}')

    prompt = "\n".join(prompt_parts)

    system_msg = (
        "You are a trading behavioral analyst. Always respond with valid JSON only, "
        "no markdown, no explanation outside the JSON structure."
    )

    try:
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt},
        ]
        result = await ai_coach._chat(messages, max_tokens=1500)
        import json
        try:
            parsed = json.loads(result)
        except (json.JSONDecodeError, TypeError):
            parsed = {
                "behavioral_summary": str(result)[:500] if result else "Unable to generate assessment",
                "strengths": [],
                "weaknesses": [],
                "recommendations": [],
                "risk_level": "unknown",
                "composite_score": None,
            }
    except Exception as e:
        logger.error("behavioral_score_failed", error=str(e))
        parsed = {
            "behavioral_summary": f"AI assessment unavailable: {str(e)}",
            "strengths": [],
            "weaknesses": [],
            "recommendations": [],
            "risk_level": "unknown",
            "composite_score": None,
        }

    return {
        "programmatic": programmatic,
        "ai_assessment": parsed,
        "lookback_days": lookback_days,
        "trades_analyzed": len(trades),
        "model_used": "ollama",
        "generated_at": _now().isoformat(),
    }


# ──────────────────────── Trade Review Engine ────────────────────────


def _load_playbook_for_trade(db: Session, trade: Trade) -> dict | None:
    """Load playbook data for a trade's setup, if it exists."""
    if not trade.setup:
        return None
    playbook = db.query(SetupPlaybook).filter(SetupPlaybook.name == trade.setup).first()
    if not playbook:
        return None
    return {
        "name": playbook.name,
        "description": playbook.description or "",
        "rules": playbook.rules or [],
        "ideal_conditions": playbook.ideal_conditions or [],
        "risk_profile": playbook.risk_profile or {},
    }


@router.post(
    "/trade-review",
    response_model=TradeReviewResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        404: {"description": "Trade not found"},
        500: {"description": "AI generation failed"},
    },
)
async def generate_trade_review(
    request: TradeReviewRequest,
    db: Session = Depends(get_db),
) -> TradeReviewResponse:
    """Generate a structured post-trade review with coaching, discipline analysis,
    execution critique, missed opportunity assessment, and setup-quality scoring.

    This is not a generic summary — it's a private trading coach that cross-references
    your playbook rules, emotions, execution grades, partial exits, and timeline events
    to produce an honest, actionable review.
    """
    trade = db.query(Trade).filter(Trade.id == request.trade_id, Trade.status != "deleted").first()
    if not trade:
        raise HTTPException(status_code=404, detail=f"Trade {request.trade_id} not found")

    lifecycle_map = _load_lifecycle_for_trades(db, [trade.id])
    lifecycle = lifecycle_map.get(trade.id)

    partial_exits = db.query(PartialExit).filter(PartialExit.trade_id == trade.id).order_by(PartialExit.exit_time.asc()).all()
    playbook = _load_playbook_for_trade(db, trade)

    trade_dict = trade_to_dict(trade, lifecycle=lifecycle, partial_exits=partial_exits, playbook=playbook)

    cfg = get_ai_config()
    model_used = cfg.get("model", "unknown")

    try:
        result = await ai_coach.generate_trade_review(trade_dict)
    except Exception as e:
        logger.error("trade_review_failed", trade_id=trade.id, error=str(e))
        result = {
            "overall_verdict": "poor_execution",
            "summary": f"Review generation failed: {str(e)}",
            "scores": {"entry_timing": 0, "exit_timing": 0, "risk_management": 0, "plan_adherence": 0, "psychology": 0, "overall": 0},
            "strengths": [],
            "weaknesses": ["Review generation failed"],
            "rule_violations": [],
            "missed_opportunity": None,
            "coaching_notes": "Review generation failed. Please try again.",
            "discipline_score": 0,
        }

    scores_data = result.get("scores", {})
    scores = TradeReviewScores(
        entry_timing=scores_data.get("entry_timing", 5),
        exit_timing=scores_data.get("exit_timing", 5),
        risk_management=scores_data.get("risk_management", 5),
        plan_adherence=scores_data.get("plan_adherence", 5),
        psychology=scores_data.get("psychology", 5),
        overall=scores_data.get("overall", 5),
    )

    missed = result.get("missed_opportunity")
    missed_obj = None
    if missed and isinstance(missed, dict):
        missed_obj = MissedOpportunity(
            better_exit_price=missed.get("better_exit_price"),
            potential_r=missed.get("potential_r"),
            note=missed.get("note", ""),
        )

    review = CoachReview(
        review_type="trade_review",
        content=json.dumps(result),
        period_start=trade.entry_time,
        period_end=trade.exit_time,
        trade_ids=[trade.id],
        summary_stats={"pnl": str(trade.pnl) if trade.pnl else "0", "r_multiple": str(trade.r_multiple) if trade.r_multiple else "N/A"},
        model_used=model_used,
        prompt_template="trade_review",
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    return TradeReviewResponse(
        trade_id=trade.id,
        overall_verdict=result.get("overall_verdict", "poor_execution"),
        summary=result.get("summary", ""),
        scores=scores,
        strengths=result.get("strengths", []),
        weaknesses=result.get("weaknesses", []),
        rule_violations=result.get("rule_violations", []),
        missed_opportunity=missed_obj,
        coaching_notes=result.get("coaching_notes", ""),
        discipline_score=result.get("discipline_score", 0),
        model_used=model_used,
        generated_at=_now().isoformat(),
    )
