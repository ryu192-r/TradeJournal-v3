from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.partial_exit import PartialExitCreate, PartialExitResponse, PartialExitListResponse
from app.db.database import get_db
from app.services.partial_exit_service import PartialExitService
from app.core.dependencies import get_current_user
from app.models.user import User

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/trades/{trade_id}/partial-exits", tags=["partial-exits"])


@router.get("", response_model=PartialExitListResponse)
def list_partial_exits(
    trade_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = PartialExitService(db)
    exits, remaining = svc.list_partial_exits(trade_id, user_id=current_user.id)
    return {"items": exits, "remaining_qty": str(remaining)}


@router.post("", response_model=PartialExitResponse, status_code=status.HTTP_201_CREATED)
def create_partial_exit(
    trade_id: int,
    payload: PartialExitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = PartialExitService(db)
    entry = svc.create_partial_exit(trade_id, payload, user_id=current_user.id)
    return entry


@router.delete("/{exit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_partial_exit(
    trade_id: int,
    exit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = PartialExitService(db)
    svc.delete_partial_exit(trade_id, exit_id, user_id=current_user.id)
    return None
