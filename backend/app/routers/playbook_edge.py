"""Playbook Edge Router — R-based setup expectancy endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.playbook_edge import (
    PlaybookEdgeListResponse,
    SetupEdgeDetailResponse,
    SetupEdgeSummaryItem,
)
from app.services.setup_edge_service import (
    calculate_setup_edge,
    get_all_setup_edges,
    get_top_setup_edge,
    get_weakest_setup_edge,
)

router = APIRouter(
    prefix="/playbook-edge",
    tags=["playbook-edge"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=PlaybookEdgeListResponse)
def list_playbook_edges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All setups with edge metrics, focus/pause lists."""
    return get_all_setup_edges(db, current_user.id)


@router.get("/top", response_model=SetupEdgeSummaryItem)
def top_playbook_edge(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Highest expectancy setup."""
    result = get_top_setup_edge(db, current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="No setup edge data available")
    return result


@router.get("/weakest", response_model=SetupEdgeSummaryItem)
def weakest_playbook_edge(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lowest expectancy setup (min 5 trades)."""
    result = get_weakest_setup_edge(db, current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="No setup edge data available")
    return result


@router.get("/{setup_name}", response_model=SetupEdgeDetailResponse)
def get_playbook_edge(
    setup_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Per-setup edge metrics, score, and condition breakdown."""
    return calculate_setup_edge(db, setup_name, current_user.id)
