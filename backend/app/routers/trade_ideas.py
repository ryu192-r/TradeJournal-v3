from fastapi import APIRouter, Depends, HTTPException, Query
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

logger = get_logger(__name__)

router = APIRouter(prefix="/ideas", tags=["trade-ideas"])


@router.post("/", response_model=TradeIdeaResponse, status_code=201)
def create_idea(
    idea: TradeIdeaCreate,
    db: Session = Depends(get_db),
):
    """Create a new trade idea."""
    try:
        created = TradeIdeaService.create(db, idea)
        logger.info("trade_idea_created", idea_id=created.id, symbol=created.symbol)
        return created
    except SQLAlchemyError as e:
        logger.exception("create_idea_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create trade idea")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=TradeIdeaListResponse)
def list_ideas(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[str] = None,
    symbol: Optional[str] = None,
    direction: Optional[str] = None,
    confidence: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List trade ideas with optional filters."""
    try:
        total, items = TradeIdeaService.list_ideas(
            db, skip=skip, limit=limit,
            status=status, symbol=symbol,
            direction=direction, confidence=confidence,
        )
        return TradeIdeaListResponse(total=total, items=items)
    except SQLAlchemyError as e:
        logger.exception("list_ideas_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to list trade ideas")


@router.get("/{idea_id}", response_model=TradeIdeaResponse)
def get_idea(
    idea_id: int,
    db: Session = Depends(get_db),
):
    """Get a single trade idea by ID."""
    db_idea = TradeIdeaService.get_by_id(db, idea_id)
    if not db_idea:
        raise HTTPException(status_code=404, detail="Trade idea not found")
    return db_idea


@router.put("/{idea_id}", response_model=TradeIdeaResponse)
def update_idea(
    idea_id: int,
    update: TradeIdeaUpdate,
    db: Session = Depends(get_db),
):
    """Update a trade idea. Status transitions are validated."""
    db_idea = TradeIdeaService.get_by_id(db, idea_id)
    if not db_idea:
        raise HTTPException(status_code=404, detail="Trade idea not found")

    try:
        updated = TradeIdeaService.update(db, idea_id, update)
        logger.info("trade_idea_updated", idea_id=idea_id, status=updated.status)
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except SQLAlchemyError:
        logger.exception("update_idea_failed", idea_id=idea_id)
        raise HTTPException(status_code=500, detail="Failed to update trade idea")


@router.delete("/{idea_id}", status_code=204)
def delete_idea(
    idea_id: int,
    db: Session = Depends(get_db),
):
    """Soft delete a trade idea (archive it)."""
    db_idea = TradeIdeaService.get_by_id(db, idea_id)
    if not db_idea:
        raise HTTPException(status_code=404, detail="Trade idea not found")

    try:
        TradeIdeaService.delete(db, idea_id)
        logger.info("trade_idea_archived", idea_id=idea_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except SQLAlchemyError:
        logger.exception("delete_idea_failed", idea_id=idea_id)
        raise HTTPException(status_code=500, detail="Failed to delete trade idea")


@router.post("/{idea_id}/trade", response_model=ConvertToTradeResponse)
def convert_to_trade(
    idea_id: int,
    convert: ConvertToTradeRequest,
    db: Session = Depends(get_db),
):
    """Convert a trade idea into an actual trade.

    Creates a Trade record (if entry_price + quantity provided) and links
    it via traded_trade_id. The idea status becomes 'traded'.
    """
    db_idea = TradeIdeaService.get_by_id(db, idea_id)
    if not db_idea:
        raise HTTPException(status_code=404, detail="Trade idea not found")

    try:
        updated_idea, new_trade = TradeIdeaService.convert_to_trade(db, idea_id, convert)
        logger.info("idea_converted_to_trade", idea_id=idea_id, trade_id=new_trade.id if new_trade else None)
        return ConvertToTradeResponse(idea=updated_idea, trade_id=new_trade.id if new_trade else None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except SQLAlchemyError:
        logger.exception("convert_to_trade_failed", idea_id=idea_id)
        raise HTTPException(status_code=500, detail="Failed to convert idea to trade")
