from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.edge_command_center import EdgeCommandCenterResponse
from app.services.edge_command_center_service import get_edge_command_center

router = APIRouter(prefix="/edge-command-center", tags=["edge-command-center"])


def _parse_period(period_start: Optional[str], period_end: Optional[str]) -> tuple[datetime, datetime]:
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    if period_start:
        try:
            start = datetime.fromisoformat(period_start.replace("Z", "+00:00").replace("+00:00", ""))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid period_start: '{period_start}'. Use ISO format (e.g. 2025-01-01).",
            )
    if period_end:
        try:
            end = datetime.fromisoformat(period_end.replace("Z", "+00:00").replace("+00:00", ""))
            end = end.replace(hour=23, minute=59, second=59, microsecond=999999)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid period_end: '{period_end}'. Use ISO format (e.g. 2025-01-31).",
            )
    if start is None:
        start = datetime.utcnow() - timedelta(days=90)
    if end is None:
        end = datetime.utcnow()
    if start > end:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="period_start must be before or equal to period_end",
        )
    return start, end


@router.get("", response_model=EdgeCommandCenterResponse)
def edge_command_center(
    period_start: Optional[str] = Query(None, description="Period start ISO date/datetime"),
    period_end: Optional[str] = Query(None, description="Period end ISO date/datetime"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unified what-should-I-do-now intelligence surface."""
    start, end = _parse_period(period_start, period_end)
    return get_edge_command_center(db, current_user.id, start, end)
