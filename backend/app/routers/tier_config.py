from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.tier_config import TierConfig
from app.schemas.tier_config import TierConfigListResponse, TierConfigItem
from app.utils.logging import get_logger
from decimal import Decimal
from app.core.dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/tier-config", tags=["tier-config"])
logger = get_logger(__name__)


DEFAULT_TIERS = [
    {"name": "Survival", "min_amount": Decimal("0"), "max_amount": Decimal("200000"), "sort_order": 0},
    {"name": "Growth", "min_amount": Decimal("200000"), "max_amount": Decimal("1000000"), "sort_order": 1},
    {"name": "Scaling", "min_amount": Decimal("1000000"), "max_amount": Decimal("5000000"), "sort_order": 2},
    {"name": "Freedom", "min_amount": Decimal("5000000"), "max_amount": None, "sort_order": 3},
]


def _ensure_default_tiers(db: Session) -> list[TierConfig]:
    existing = db.query(TierConfig).order_by(TierConfig.sort_order).all()
    if existing:
        return existing
    for t in DEFAULT_TIERS:
        db.add(TierConfig(**t))
    db.commit()
    return db.query(TierConfig).order_by(TierConfig.sort_order).all()


@router.get("", response_model=TierConfigListResponse)
def list_tiers(db: Session = Depends(get_db)):
    tiers = _ensure_default_tiers(db)
    return TierConfigListResponse(items=[
        {"id": t.id, "name": t.name, "min_amount": t.min_amount, "max_amount": t.max_amount, "sort_order": t.sort_order}
        for t in tiers
    ])


@router.put("", response_model=TierConfigListResponse)
def update_tiers(payload: list[TierConfigItem], db: Session = Depends(get_db)):
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tier list cannot be empty")
    # Validate: no gaps, non-negative, ascending order
    sorted_payload = sorted(payload, key=lambda x: x.sort_order)
    for i, t in enumerate(sorted_payload):
        if t.min_amount < 0:
            raise HTTPException(status_code=400, detail=f"Tier '{t.name}' min_amount must be >= 0")
        if t.max_amount is not None and t.max_amount <= t.min_amount:
            raise HTTPException(status_code=400, detail=f"Tier '{t.name}' max_amount must be > min_amount")
        if i > 0:
            prev = sorted_payload[i - 1]
            if prev.max_amount is None:
                raise HTTPException(status_code=400, detail=f"Tier '{prev.name}' has no max_amount — only the last tier can be unbounded")
            if t.min_amount != prev.max_amount:
                raise HTTPException(status_code=400, detail=f"Tier gap between '{prev.name}' and '{t.name}': {prev.max_amount} != {t.min_amount}")

    # Replace all
    db.query(TierConfig).delete()
    db.commit()

    for t in sorted_payload:
        db.add(TierConfig(
            name=t.name,
            min_amount=t.min_amount,
            max_amount=t.max_amount,
            sort_order=t.sort_order,
        ))
    db.commit()

    tiers = db.query(TierConfig).order_by(TierConfig.sort_order).all()
    return TierConfigListResponse(items=[
        {"id": t.id, "name": t.name, "min_amount": t.min_amount, "max_amount": t.max_amount, "sort_order": t.sort_order}
        for t in tiers
    ])
