from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional

from app.schemas.trade_idea import (
    TradeIdeaCreate,
    TradeIdeaUpdate,
    TradeIdeaResponse,
    TradeIdeaListResponse,
    ConvertToTradeRequest,
    ConvertToTradeResponse,
)
from app.services.trade_idea_service import TradeIdeaService
from app.db.database import get_db
from app.utils.logging import get_logger
from app.core.dependencies import get_current_user
from app.models.user import User

logger = get_logger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/ideas", tags=["trade-ideas"])


@router.post("/", response_model=TradeIdeaResponse, status_code=201)
def create_idea(
    idea: TradeIdeaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new trade idea."""
    try:
        created = TradeIdeaService.create(db, idea, user_id=current_user.id)
        logger.info("trade_idea_created", idea_id=created.id, symbol=created.symbol)
        return created
    except SQLAlchemyError as e:
        logger.exception("create_idea_failed", error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create trade idea")

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{idea_id}", response_model=dict)
def get_trade_idea(
    idea_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single trade idea by ID."""
    db_idea = TradeIdeaService.get_by_id(db, idea_id, user_id=current_user.id)
    if not db_idea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade idea not found")
    return db_idea


@router.patch("/{idea_id}", response_model=dict)
def update_trade_idea(
    idea_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a trade idea. Status transitions are validated."""
    db_idea = TradeIdeaService.get_by_id(db, idea_id, user_id=current_user.id)
    if not db_idea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade idea not found")

    try:
        updated = TradeIdeaService.update_idea(db, db_idea, data)
        if not updated:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update trade idea")
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{idea_id}")
def delete_trade_idea(
    idea_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft delete a trade idea (archive it)."""
    try:
        ok = TradeIdeaService.delete(db, idea_id, user_id=current_user.id)
        if not ok:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade idea not found")
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", response_model=TradeIdeaListResponse)
def list_ideas(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[str] = None,
    symbol: Optional[str] = None,
    direction: Optional[str] = None,
    confidence: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List trade ideas with optional filters."""
    try:
        total, items = TradeIdeaService.list_ideas(
            db, skip=skip, limit=limit,
            status=status, symbol=symbol,
            direction=direction, confidence=confidence,
            user_id=current_user.id,
        )
        return TradeIdeaListResponse(total=total, items=items)
    except SQLAlchemyError as e:
        logger.exception("list_ideas_failed", error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list trade ideas")


@router.get("/{idea_id}", response_model=TradeIdeaResponse)
def get_idea(
    idea_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single trade idea by ID."""
    db_idea = TradeIdeaService.get_by_id(db, idea_id, user_id=current_user.id)
    if not db_idea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade idea not found")
    return db_idea


@router.put("/{idea_id}", response_model=TradeIdeaResponse)
def update_idea(
    idea_id: int,
    update: TradeIdeaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a trade idea. Status transitions are validated."""
    db_idea = TradeIdeaService.get_by_id(db, idea_id, user_id=current_user.id)
    if not db_idea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade idea not found")

    try:
        updated = TradeIdeaService.update(db, idea_id, update)
        logger.info("trade_idea_updated", idea_id=idea_id, status=updated.status)
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except SQLAlchemyError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to convert idea to trade")


@router.post("/{idea_id}/trade", response_model=ConvertToTradeResponse)
def convert_idea_to_trade(
    idea_id: int,
    convert: ConvertToTradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Convert a trade idea into an actual trade."""
    try:
        updated_idea, new_trade = TradeIdeaService.convert_to_trade(
            db, idea_id, convert, user_id=current_user.id
        )
        logger.info("idea_converted_to_trade", idea_id=idea_id, trade_id=new_trade.id if new_trade else None)
        return ConvertToTradeResponse(
            idea=TradeIdeaResponse.model_validate(updated_idea),
            trade_id=new_trade.id if new_trade else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except SQLAlchemyError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to convert idea to trade")
