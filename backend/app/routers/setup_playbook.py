from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from typing import List, Optional

from app.schemas.setup_playbook import (
    SetupPlaybookCreate,
    SetupPlaybookUpdate,
    SetupPlaybookResponse,
    SetupPlaybookListResponse,
)
from app.models.setup_playbook import SetupPlaybook
from app.models.user import User
from app.db.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/setups", tags=["setup-playbook"])


# ─────────────────────── create ───────────────────────

@router.post(
    "/",
    response_model=SetupPlaybookResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"description": "Setup with this name already exists"},
        422: {"description": "Validation error"},
    },
)
def create_setup(
    setup: SetupPlaybookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SetupPlaybookResponse:
    """Create a new setup playbook entry."""
    existing = db.execute(
        select(SetupPlaybook).where(SetupPlaybook.name == setup.name)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Setup '{setup.name}' already exists.",
        )

    db_setup = SetupPlaybook(
        name=setup.name,
        description=setup.description,
        tactics=[t.model_dump() for t in setup.tactics],
        ideal_conditions=setup.ideal_conditions,
        risk_profile=setup.risk_profile.model_dump(),
        rules=setup.rules,
        is_active="active",
    )
    db.add(db_setup)
    db.commit()
    db.refresh(db_setup)
    return db_setup


# ─────────────────────── list ───────────────────────

@router.get("/", response_model=SetupPlaybookListResponse)
def list_setups(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SetupPlaybookListResponse:
    """List setup playbooks with optional active filter."""
    query = select(SetupPlaybook)
    if is_active:
        query = query.where(SetupPlaybook.is_active == is_active)

    count_stmt = select(func.count()).select_from(SetupPlaybook)
    if is_active:
        count_stmt = count_stmt.where(SetupPlaybook.is_active == is_active)
    total_count = db.execute(count_stmt).scalar() or 0

    stmt = query.order_by(SetupPlaybook.name).offset(skip).limit(limit)
    items = list(db.execute(stmt).scalars().all())

    return SetupPlaybookListResponse(total=total_count, items=items)


# ─────────────────────── get single ───────────────────────

@router.get(
    "/{setup_id}",
    response_model=SetupPlaybookResponse,
    responses={
        404: {"description": "Setup not found"},
    },
)
def get_setup(
    setup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SetupPlaybookResponse:
    """Get a single setup playbook by ID."""
    db_setup = db.execute(
        select(SetupPlaybook).where(SetupPlaybook.id == setup_id)
    ).scalar_one_or_none()
    if not db_setup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setup with id {setup_id} not found.",
        )
    return db_setup


# ─────────────────────── update ───────────────────────

@router.put(
    "/{setup_id}",
    response_model=SetupPlaybookResponse,
    responses={
        404: {"description": "Setup not found"},
        409: {"description": "Name conflict with another setup"},
        422: {"description": "Validation error"},
    },
)
def update_setup(
    setup_id: int,
    setup_update: SetupPlaybookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SetupPlaybookResponse:
    """Update an existing setup playbook."""
    db_setup = db.execute(
        select(SetupPlaybook).where(SetupPlaybook.id == setup_id)
    ).scalar_one_or_none()
    if not db_setup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setup with id {setup_id} not found.",
        )

    update_data = setup_update.model_dump(exclude_unset=True)

    # If name is being changed, check for conflicts
    if "name" in update_data and update_data["name"] != db_setup.name:
        conflict = db.execute(
            select(SetupPlaybook).where(
                SetupPlaybook.name == update_data["name"],
                SetupPlaybook.id != setup_id,
            )
        ).scalar_one_or_none()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Setup '{update_data['name']}' already exists.",
            )

    # Tactics and risk_profile are JSON dicts — apply as-is
    if "tactics" in update_data:
        db_setup.tactics = [t if isinstance(t, dict) else t.model_dump() for t in update_data["tactics"]]
    if "risk_profile" in update_data:
        rp = update_data["risk_profile"]
        db_setup.risk_profile = rp if isinstance(rp, dict) else rp.model_dump()

    # Simple scalar fields
    for key in ("description", "rules", "ideal_conditions", "is_active", "name"):
        if key in update_data:
            setattr(db_setup, key, update_data[key])

    db.commit()
    db.refresh(db_setup)
    return db_setup


# ─────────────────────── delete ───────────────────────

@router.delete(
    "/{setup_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"description": "Setup not found"},
    },
)
def delete_setup(
    setup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Archive (soft-delete) a setup playbook by setting is_active=archived."""
    db_setup = db.execute(
        select(SetupPlaybook).where(SetupPlaybook.id == setup_id)
    ).scalar_one_or_none()
    if not db_setup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setup with id {setup_id} not found.",
        )
    db_setup.is_active = "archived"
    db.commit()
    return None


# ─────────────────────── seed defaults ───────────────────────

@router.post(
    "/seed",
    response_model=SetupPlaybookListResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"description": "Some setups already exist"},
    },
)
def seed_default_setups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SetupPlaybookListResponse:
    """Create default setup playbooks if they don't already exist.
    
    This populates the 7 canonical setups from the user's playbook.
    Skips any setup whose name already exists.
    """
    defaults = [
        {
            "name": "Episodic Pivot",
            "description": "A strong news or catalyst driven gap that breaks structure after a prolonged base.",
            "tactics": [
                {"name": "Gap & Go", "conditions": ["high relative volume", "clear catalyst news", "no overhead resistance"]},
                {"name": "Opening Range Breakout", "conditions": ["wide opening range", "sustained volume", "sector tailwinds"]}
            ],
            "ideal_conditions": [
                "Strong catalyst (earnings surprise, regulatory change, contract award)",
                "High relative volume (>3x average)",
                "Price breaking above multi-month consolidation",
                "Favorable sector momentum"
            ],
            "risk_profile": {"max_risk_pct": 2.0, "position_sizing_rule": "1% risk per trade", "stop_style": "structure_below_low"},
            "rules": [
                "Never enter without a clear catalyst",
                "Volume must be at least 2x average in first 30 min",
                "Stop loss at the low of the breakout candle",
            ],
        },
        {
            "name": "Momentum Burst",
            "description": "Strong continuation after a brief consolidation in an established trend.",
            "tactics": [
                {"name": "Flag Breakout", "conditions": ["tight flag pattern", "volume expansion on break", "RSI > 50"]}
            ],
            "ideal_conditions": [
                "Established uptrend (>20% from recent low)",
                "Brief consolidation (3-8 days)",
                "Volume drying up during consolidation",
                "Breakout on expanding volume"
            ],
            "risk_profile": {"max_risk_pct": 1.5, "position_sizing_rule": "1% risk per trade", "stop_style": "atr_based"},
            "rules": [
                "Only enter on breakout with volume confirmation",
                "Avoid if RSI > 80 (overbought)",
                "Trail stop using 2x ATR",
            ],
        },
        {
            "name": "Pullback",
            "description": "Buying the dip in a strong trend at key support levels.",
            "tactics": [
                {"name": "10-DMA Touch", "conditions": ["strong prior trend", "pullback to 10-DMA", "bullish reversal candle"]},
                {"name": "Previous Day Low Bounce", "conditions": ["trend intact", "bounce off PDH", "support holds"]}
            ],
            "ideal_conditions": [
                "Strong uptrend (>15% in 5 days)",
                "Pullback to 10-DMA or VWAP",
                "Reversal candle at support",
                "Volume declining on pullback"
            ],
            "risk_profile": {"max_risk_pct": 1.5, "position_sizing_rule": "1% risk per trade", "stop_style": "structure_below_support"},
            "rules": [
                "Confirm the trend is intact (not breaking down)",
                "Wait for reversal candle before entry",
                "Stop loss below the support level",
            ],
        },
        {
            "name": "Reversal",
            "description": "Counter-trend trade after exhaustion signals at key levels.",
            "tactics": [
                {"name": "Double Top/Bottom", "conditions": ["clear double pattern", "volume divergence", "key level"]},
                {"name": "RSI Divergence", "conditions": ["price makes new high/low", "RSI divergence", "momentum fading"]}
            ],
            "ideal_conditions": [
                "Clear exhaustion signal (long upper wick, volume spike at top)",
                "Key support/resistance level",
                "RSI divergence or momentum fading",
                "Confirmation candle in reversal direction"
            ],
            "risk_profile": {"max_risk_pct": 1.0, "position_sizing_rule": "0.5% risk (reversals are lower conviction)", "stop_style": "tight_structure"},
            "rules": [
                "Wait for confirmation — don't anticipate",
                "Size smaller than trend-following trades",
                "Target is the prior swing, not a runner",
            ],
        },
        {
            "name": "IPO",
            "description": "Trading freshly listed stocks in their price discovery phase.",
            "tactics": [
                {"name": "Listing Day Pop", "conditions": ["oversubscribed IPO", "strong sector", "clear offering price support"]}
            ],
            "ideal_conditions": [
                "Oversubscribed IPO (>10x)",
                "Strong sector tailwinds",
                "Listing price near offer price (not a massive premium)",
                "Institutional interest evident"
            ],
            "risk_profile": {"max_risk_pct": 1.0, "position_sizing_rule": "0.5% risk (high volatility)", "stop_style": "offer_price_based"},
            "rules": [
                "Only trade IPOs in first 5 days of listing",
                "Use offer price as reference support",
                "Avoid if listing at massive premium to offer",
            ],
        },
        {
            "name": "Gap Up",
            "description": "Morning gap driven by pre-market news or overnight global cues.",
            "tactics": [
                {"name": "Gap Fill Fade", "conditions": ["gap >3%", "no strong catalyst", "historical tendency to fill"]},
                {"name": "Gap & Hold", "conditions": ["strong catalyst", "volume support", "sector strength"]}
            ],
            "ideal_conditions": [
                "Gap driven by specific catalyst (not just market-wide)",
                "Volume support on the gap",
                "Price holds above the gap level (or fills if fading)",
                "Pre-market trend aligns with trade direction"
            ],
            "risk_profile": {"max_risk_pct": 1.5, "position_sizing_rule": "1% risk per trade", "stop_style": "gap_level_based"},
            "rules": [
                "Identify catalyst before the open",
                "Wait 15 minutes after open before entry",
                "Stop loss at gap fill level (for gap & hold)",
            ],
        },
        {
            "name": "Parabolic Long",
            "description": "Extended momentum trades in stocks going parabolic — high risk, high reward.",
            "tactics": [
                {"name": "First Pullback Entry", "conditions": ["3+ consecutive up days", "first red day", "holds above VWAP"]},
                {"name": "Volume Spike Breakout", "conditions": ["unusual volume spike", "break above prior high", "sector momentum"]}
            ],
            "ideal_conditions": [
                "3+ consecutive strong up days",
                "Volume significantly above average",
                "Stock breaking multi-week/multi-month highs",
                "Strong sector and market tailwinds"
            ],
            "risk_profile": {"max_risk_pct": 1.0, "position_sizing_rule": "0.5% risk (parabolic = high risk)", "stop_style": "trailing_tight"},
            "rules": [
                "Never hold overnight if possible",
                "Use tight trailing stops",
                "Take partial profits at 2R",
                "Avoid if daily RSI > 90",
            ],
        },
    ]

    created: list[SetupPlaybook] = []
    for default in defaults:
        existing = db.execute(
            select(SetupPlaybook).where(SetupPlaybook.name == default["name"])
        ).scalar_one_or_none()
        if existing:
            continue
        db_setup = SetupPlaybook(
            name=default["name"],
            description=default["description"],
            tactics=default["tactics"],
            ideal_conditions=default["ideal_conditions"],
            risk_profile=default["risk_profile"],
            rules=default["rules"],
            is_active="active",
        )
        db.add(db_setup)
        created.append(db_setup)

    db.commit()
    for item in created:
        db.refresh(item)

    # Return all setups (existing + newly created)
    all_setups = list(db.execute(
        select(SetupPlaybook).order_by(SetupPlaybook.name)
    ).scalars().all())

    return SetupPlaybookListResponse(total=len(all_setups), items=all_setups)
