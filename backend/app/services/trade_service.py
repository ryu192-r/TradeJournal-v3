"""Trade domain service for business logic."""
from typing import Optional, Tuple
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import datetime

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

    def get_by_symbol_date(self, symbol: str, entry_date: datetime) -> Optional[Trade]:
        """Find existing trade for same symbol on the same calendar date."""
        return (
            self.db.query(Trade)
            .filter(
                Trade.symbol == symbol,
                func.date(Trade.entry_time) == entry_date.date(),
            )
            .first()
        )

    def merge_or_create(self, trade_data: dict) -> Tuple[Trade, str]:
        """Merge with existing trade for same (symbol, date) or create new.

        Returns (trade, action) where action is 'merged' or 'created'.
        """
        entry_time = trade_data.get("entry_time")
        if not entry_time:
            trade = Trade(**trade_data)
            trade.compute_pnl()
            self.db.add(trade)
            self.db.commit()
            self.db.refresh(trade)
            return trade, "created"

        existing = self.get_by_symbol_date(trade_data["symbol"], entry_time)
        if existing:
            self._merge_trade(existing, trade_data)
            return existing, "merged"

        trade = Trade(**trade_data)
        trade.compute_pnl()
        self.db.add(trade)
        self.db.commit()
        self.db.refresh(trade)
        return trade, "created"

    def _merge_trade(self, existing: Trade, incoming: dict) -> Trade:
        """Merge incoming trade data into existing trade (same symbol+date).

        Weighted-average entry/exit prices, sum quantities/fees/PnL,
        keep earliest entry_time, latest exit_time.
        """
        old_qty = Decimal(str(existing.quantity or "0"))
        new_qty = Decimal(str(incoming.get("quantity", "0")))
        total_qty = old_qty + new_qty

        if total_qty > 0 and old_qty > 0 and incoming.get("entry_price"):
            existing.entry_price = (
                Decimal(str(existing.entry_price)) * old_qty
                + Decimal(str(incoming["entry_price"])) * new_qty
            ) / total_qty
        elif incoming.get("entry_price") and not existing.entry_price:
            existing.entry_price = Decimal(str(incoming["entry_price"]))

        existing.quantity = total_qty

        incoming_time = incoming.get("entry_time")
        if incoming_time and incoming_time < existing.entry_time:
            existing.entry_time = incoming_time

        existing_exit = existing.exit_price
        incoming_exit = incoming.get("exit_price")
        if existing_exit and incoming_exit:
            existing.exit_price = (
                Decimal(str(existing_exit)) * old_qty
                + Decimal(str(incoming_exit)) * new_qty
            ) / total_qty
            exist_exit_time = existing.exit_time
            in_exit_time = incoming.get("exit_time")
            if in_exit_time and (not exist_exit_time or in_exit_time > exist_exit_time):
                existing.exit_time = in_exit_time
        elif incoming_exit:
            existing.exit_price = Decimal(str(incoming_exit))
            existing.exit_time = incoming.get("exit_time")

        existing.fees = (existing.fees or Decimal("0")) + Decimal(str(incoming.get("fees", "0")))

        if existing.pnl and incoming.get("pnl"):
            existing.pnl = existing.pnl + Decimal(str(incoming["pnl"]))
        elif incoming.get("pnl") and not existing.pnl:
            existing.pnl = Decimal(str(incoming["pnl"]))
        else:
            existing.compute_pnl()

        self.db.commit()
        self.db.refresh(existing)
        return existing

    def pyramid_trade(self, trade_id: int, entry_price: Decimal, quantity: Decimal,
                      entry_time: Optional[datetime] = None,
                      fees: Optional[Decimal] = None,
                      stop_price: Optional[Decimal] = None) -> Trade:
        """Pyramid — add more shares to an open position.

        Updates entry price (weighted average), sums quantity, keeps earliest
        entry time, sums fees, optionally updates stop loss.
        Only allowed on OPEN trades (no exit).
        """
        trade = self.db.query(Trade).filter(Trade.id == trade_id).first()
        if not trade:
            raise ValueError("Trade not found")
        if trade.exit_price is not None:
            raise ValueError("Cannot pyramid a closed trade")

        old_qty = Decimal(str(trade.quantity))
        new_qty = Decimal(str(quantity))
        total_qty = old_qty + new_qty

        trade.entry_price = (trade.entry_price * old_qty + entry_price * new_qty) / total_qty
        trade.quantity = total_qty
        if entry_time and entry_time < trade.entry_time:
            trade.entry_time = entry_time
        if fees:
            trade.fees = (trade.fees or Decimal("0")) + fees
        if stop_price is not None:
            trade.stop_price = stop_price

        self.db.commit()
        self.db.refresh(trade)
        return trade

    def merge_duplicates(self) -> int:
        """Find and merge trades with same (symbol, date). Returns count of merged duplicates."""
        from collections import defaultdict

        trades = self.db.query(Trade).filter(Trade.status != 'deleted').all()
        groups = defaultdict(list)
        for t in trades:
            key = (t.symbol, t.entry_time.date())
            groups[key].append(t)

        merged_count = 0
        for key, group in groups.items():
            if len(group) <= 1:
                continue
            group.sort(key=lambda t: t.entry_time)
            keep = group[0]
            for dup in group[1:]:
                dup_data = {
                    "symbol": dup.symbol,
                    "direction": dup.direction,
                    "entry_price": str(dup.entry_price),
                    "quantity": str(dup.quantity),
                    "entry_time": dup.entry_time,
                    "exit_price": str(dup.exit_price) if dup.exit_price else None,
                    "exit_time": dup.exit_time,
                    "fees": str(dup.fees or "0"),
                    "setup": dup.setup,
                    "tactic": dup.tactic,
                    "stop_price": str(dup.stop_price) if dup.stop_price else None,
                    "target_price": str(dup.target_price) if dup.target_price else None,
                    "r_multiple": str(dup.r_multiple) if dup.r_multiple else None,
                    "status": dup.status,
                    "notes": dup.notes,
                }
                self._merge_trade(keep, dup_data)
                self.db.delete(dup)
                merged_count += 1

        if merged_count > 0:
            self.db.commit()
        return merged_count

    def create_from_dhan_leg(self, leg, direction: str = "LONG", is_open: bool = True) -> Trade:
        """Map a Dhan trade leg to our Trade model."""
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

        trade_data = {
            "symbol": leg.trading_symbol,
            "direction": direction,
            "entry_price": entry_price,
            "exit_price": exit_price,
            "quantity": Decimal(str(leg.quantity)),
            "entry_time": entry_time,
            "exit_time": exit_time,
            "fees": Decimal("0"),
            "status": "draft",
            "setup": None,
            "tactic": None,
        }
        trade, _ = self.merge_or_create(trade_data)
        return trade

    def find_or_create_pair(self, open_leg, close_leg, direction: str = "LONG") -> Trade:
        """Match OPEN and CLOSE legs into a single trade, merging by (symbol, date)."""
        entry_time = datetime.fromisoformat(open_leg.order_timestamp.replace("Z", "+00:00"))
        exit_time = datetime.fromisoformat(close_leg.order_timestamp.replace("Z", "+00:00")) if close_leg else None

        trade_data = {
            "symbol": open_leg.trading_symbol,
            "direction": direction,
            "entry_price": Decimal(str(open_leg.price)),
            "exit_price": Decimal(str(close_leg.price)) if close_leg else None,
            "quantity": Decimal(str(open_leg.quantity)),
            "entry_time": entry_time,
            "exit_time": exit_time,
            "fees": Decimal("0"),
            "status": "draft",
        }
        trade, _ = self.merge_or_create(trade_data)
        return trade