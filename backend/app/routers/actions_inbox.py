"""Actions Inbox API — normalized actionable items."""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.actions_inbox import ActionsInboxResponse
from app.services.actions_inbox_service import get_actions_inbox

router = APIRouter(prefix="/actions", tags=["actions"])


@router.get("/inbox", response_model=ActionsInboxResponse)
def actions_inbox(
    interface_mode: Optional[Literal["simple", "pro"]] = Query(
        "simple",
        description="Filter items for Simple vs Pro interface mode",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return open actionable items aggregated from trades, journal, risk, and edge."""
    mode = interface_mode if interface_mode in ("simple", "pro") else "simple"
    return get_actions_inbox(db, current_user.id, interface_mode=mode)
