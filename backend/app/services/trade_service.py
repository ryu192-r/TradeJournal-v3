"""Trade domain service for business logic."""
from typing import Optional, Tuple
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.trade import Trade


class TradeService:
    def __init__(self, db: Session):
        self.db = db

    def get_by_symbol_time(self, symbol: str, entry_time, exit_time=None) -> Optional[Trade]:
        """Check if a trade with same symbol+times already exists."""
        q = self.db.query(Trade).filter(
            and_(
                Trade.symbol == symbol,
                Trade.entry_time == entry_time,
            )
        )
        if exit_time:
            q = q.filter(Trade.exit_time == exit_time)
        return q.first()

    def create_from_dhan_leg(self, leg, direction: str, is_open: bool) -> Trade:
        """Map a Dhan trade leg to our Trade model."""
        from datetime import datetime

        entry_price = None
        exit_price = None
        entry_time = None
        exit_time = None
        if is_open:
            entry_price = Decimal(str(leg.price))
            entry_time = datetime.fromisoformat(leg.order_timestamp.replace("Z", "+00:00"))
        else:
            exit_price = Decimal(str(leg.price))
            exit_time = datetime.fromisoformat(leg.order_timestamp.replace("Z", "+00:00"))

        trade = Trade(
            symbol=leg.trading_symbol,
            direction=direction,
            entry_price=entry_price,
            exit_price=exit_price,
            quantity=Decimal(str(leg.quantity)),
            entry_time=entry_time,
            exit_time=exit_time,
            fees=Decimal("0"),
            status="draft",
            setup=None,
            tactic=None,
        )
        if exit_price and entry_price:
            trade.compute_pnl()
        self.db.add(trade)
        self.db.commit()
        self.db.refresh(trade)
        return trade

    def find_or_create_pair(self, open_leg, close_leg, direction: str) -> Trade:
        """Match OPEN and CLOSE legs into a single trade."""
        from datetime import datetime
        entry_time = datetime.fromisoformat(open_leg.order_timestamp.replace("Z", "+00:00"))
        exit_time = datetime.fromisoformat(close_leg.order_timestamp.replace("Z", "+00:00")) if close_leg else None

        existing = self.get_by_symbol_time(open_leg.trading_symbol, entry_time, exit_time)
        if existing:
            return existing

        trade = Trade(
            symbol=open_leg.trading_symbol,
            direction=direction,
            entry_price=Decimal(str(open_leg.price)),
            exit_price=Decimal(str(close_leg.price)) if close_leg else None,
            quantity=Decimal(str(open_leg.quantity)),
            entry_time=entry_time,
            exit_time=exit_time,
            fees=Decimal("0"),
            status="draft",
        )
        trade.compute_pnl()
        self.db.add(trade)
        self.db.commit()
        self.db.refresh(trade)
        return trade
