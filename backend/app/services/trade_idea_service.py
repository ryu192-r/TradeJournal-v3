from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_

from app.models.trade_idea import TradeIdea
from app.models.trade import Trade
from app.schemas.trade_idea import TradeIdeaCreate, TradeIdeaUpdate, ConvertToTradeRequest


# Valid status transitions
VALID_TRANSITIONS = {
    "draft": ["active", "archived"],
    "active": ["traded", "archived"],
    "traded": ["archived"],
    "archived": ["draft"],  # allow reactivating by resetting to draft
}


class TradeIdeaService:
    """CRUD + business logic for trade ideas."""

    # ─────────────────────── CRUD ───────────────────────

    @staticmethod
    def create(db: Session, idea: TradeIdeaCreate, user_id: Optional[int] = None) -> TradeIdea:
        """Create a new trade idea."""
        db_idea = TradeIdea(
            symbol=idea.symbol,
            direction=idea.direction,
            entry_price_target=idea.entry_price_target,
            stop_price=idea.stop_price,
            target_price=idea.target_price,
            thesis=idea.thesis,
            timeframe=idea.timeframe,
            confidence=idea.confidence,
            tags=idea.tags,
            revisit_date=idea.revisit_date,
            status=idea.status,
        )
        if user_id is not None:
            db_idea.user_id = user_id
        db.add(db_idea)
        db.commit()
        db.refresh(db_idea)
        return db_idea

    @staticmethod
    def get_by_id(db: Session, idea_id: int, user_id: Optional[int] = None) -> Optional[TradeIdea]:
        """Fetch a single trade idea by ID."""
        q = db.query(TradeIdea).filter(TradeIdea.id == idea_id)
        if user_id is not None:
            q = q.filter(TradeIdea.user_id == user_id)
        return q.first()

    @staticmethod
    def list_ideas(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        symbol: Optional[str] = None,
        direction: Optional[str] = None,
        confidence: Optional[str] = None,
        user_id: Optional[int] = None,
    ):
        """List trade ideas with optional filters."""
        query = db.query(TradeIdea)
        if user_id is not None:
            query = query.filter(TradeIdea.user_id == user_id)
        if status:
            query = query.filter(TradeIdea.status == status)
        if symbol:
            query = query.filter(TradeIdea.symbol == symbol)
        if direction:
            query = query.filter(TradeIdea.direction == direction)
        if confidence:
            query = query.filter(TradeIdea.confidence == confidence)

        total = query.count()
        ideas = query.order_by(TradeIdea.created_at.desc()).offset(skip).limit(limit).all()
        return total, ideas

    @staticmethod
    def update(db: Session, idea_id: int, update: TradeIdeaUpdate, user_id: Optional[int] = None) -> Optional[TradeIdea]:
        """Update a trade idea with validated status transition."""
        db_idea = TradeIdeaService.get_by_id(db, idea_id, user_id=user_id)
        if not db_idea:
            return None

        update_data = update.model_dump(exclude_unset=True)

        # Validate status transition before mutating
        if "status" in update_data:
            new_status = update_data["status"]
            if not _validate_status_transition(db_idea.status, new_status):
                raise ValueError(
                    f"Invalid status transition from {db_idea.status} to {new_status}. "
                    f"Valid transitions: {VALID_TRANSITIONS.get(db_idea.status, [])}"
                )

        for field, value in update_data.items():
            if value is not None:
                setattr(db_idea, field, value)

        db.commit()
        db.refresh(db_idea)
        return db_idea

    @staticmethod
    def delete(db: Session, idea_id: int, user_id: Optional[int] = None) -> bool:
        """Soft delete by setting status to archived."""
        db_idea = TradeIdeaService.get_by_id(db, idea_id, user_id=user_id)
        if not db_idea:
            return False

        if db_idea.status == "traded":
            raise ValueError("Cannot delete an idea that has been traded. Archive instead.")

        db_idea.status = "archived"
        db.commit()
        return True

    @staticmethod
    def get_revisits_due(db: Session) -> List[TradeIdea]:
        """Get ideas that are past their revisit_date and still active/draft."""
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        return (
            db.query(TradeIdea)
            .filter(
                TradeIdea.revisit_date.isnot(None),
                TradeIdea.revisit_date <= now,
                TradeIdea.status.in_(["draft", "active"]),
            )
            .all()
        )

    @staticmethod
    def convert_to_trade(
        db: Session,
        idea_id: int,
        convert: ConvertToTradeRequest,
        user_id: int,
    ) -> tuple[TradeIdea, Optional[Trade]]:
        """Convert a trade idea into an actual trade.

        Links the idea to the new trade via traded_trade_id.
        Returns (updated_idea, created_trade). Trade creation is optional —
        the idea can be marked 'traded' without creating a journal entry if
        the trade was executed outside the journal.
        """
        db_idea = TradeIdeaService.get_by_id(db, idea_id, user_id=user_id)
        if not db_idea:
            raise ValueError("Trade idea not found")

        if db_idea.status not in ("draft", "active"):
            raise ValueError(
                f"Cannot convert idea with status '{db_idea.status}'. Must be draft or active."
            )

        new_trade = None

        # Create a trade if we have minimum data
        if convert.entry_price and convert.quantity:
            entry_price = convert.entry_price or db_idea.entry_price_target
            if not entry_price:
                raise ValueError("entry_price is required (no target in idea)")

            thesis_notes = db_idea.thesis or ""
            if convert.notes:
                thesis_notes = f"{thesis_notes}\n\nAdditional: {convert.notes}" if thesis_notes else convert.notes

            entry_time = convert.entry_time or datetime.now(timezone.utc).replace(tzinfo=None)
            new_trade = Trade(
                symbol=db_idea.symbol,
                direction=db_idea.direction,
                entry_price=entry_price,
                exit_price=convert.exit_price,
                quantity=convert.quantity,
                entry_time=entry_time,
                exit_time=convert.exit_time,
                fees=convert.fees or Decimal("0"),
                notes=thesis_notes,
                stop_price=db_idea.stop_price,
                target_price=db_idea.target_price,
                user_id=user_id,
            )
            new_trade.compute_pnl()
            if new_trade.exit_price is not None:
                new_trade.status = "closed"
            else:
                new_trade.status = "open"
            new_trade.compute_pnl()
            db.add(new_trade)
            db.flush()  # get the ID without committing yet

        # Update the idea to traded
        db_idea.status = "traded"
        db_idea.traded_trade_id = new_trade.id if new_trade else None
        db_idea.triggered_at = datetime.now(timezone.utc).replace(tzinfo=None)

        db.commit()
        if new_trade:
            db.refresh(new_trade)
        db.refresh(db_idea)

        # Reconcile account and update playbook stats after trade creation
        if new_trade:
            from app.services.capital_service import _auto_reconcile
            from app.services.setup_playbook_service import _update_setup_stats
            _auto_reconcile(db, user_id=user_id)
            _update_setup_stats(db, new_trade.setup, user_id=user_id)

        return db_idea, new_trade


def _validate_status_transition(current: str, new: str) -> bool:
    return new in VALID_TRANSITIONS.get(current, [])
