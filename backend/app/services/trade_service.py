"""Trade domain service for business logic."""
from typing import Optional, Tuple
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import datetime, timezone, timedelta

from app.models.trade import Trade
from app.models.partial_exit import PartialExit

IST = timezone(timedelta(hours=5, minutes=30))


def _to_ist_naive(dt: datetime) -> datetime:
    """Convert any datetime to naive IST (strip timezone after converting)."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(IST)
    return dt.replace(tzinfo=None)


class TradeService:
    def __init__(self, db: Session):
        self.db = db

    def get_by_symbol_time(self, symbol: str, entry_time, exit_time=None, user_id: Optional[int] = None) -> Optional[Trade]:
        """Check if a trade with same symbol+times already exists."""
        q = self.db.query(Trade).filter(
            and_(
                Trade.symbol == symbol,
                Trade.entry_time == entry_time,
            )
        )
        if user_id is not None:
            q = q.filter(Trade.user_id == user_id)
        if exit_time:
            q = q.filter(Trade.exit_time == exit_time)
        return q.first()

    def get_by_symbol_date(self, symbol: str, entry_date: datetime, is_open: Optional[bool] = None, user_id: Optional[int] = None) -> Optional[Trade]:
        """Find existing trade for same symbol on the same calendar date.

        If is_open is specified, only match trades with matching open/closed state:
          is_open=True  → match trades with no exit_price (open)
          is_open=False → match trades with exit_price set (closed)
        This prevents merging an open re-entry into a closed trade or vice versa.
        """
        q = self.db.query(Trade).filter(
            Trade.symbol == symbol,
            func.date(Trade.entry_time) == entry_date.date(),
            Trade.status != "deleted",
        )
        if user_id is not None:
            q = q.filter(Trade.user_id == user_id)
        if is_open is True:
            q = q.filter(Trade.exit_price.is_(None))
        elif is_open is False:
            q = q.filter(Trade.exit_price.isnot(None))
        return q.first()

    def get_by_exact_signature(self, symbol: str, entry_price, quantity, entry_time, exit_price=None, exit_time=None, user_id: Optional[int] = None) -> Optional[Trade]:
        """Find existing trade matching exact identity: symbol + entry_price + qty + entry_time + exit_time.

        This is used for broker import deduplication — only rows that represent
        the exact same trade are merged, not merely same symbol + date.
        """
        q = self.db.query(Trade).filter(
            Trade.symbol == symbol,
            Trade.entry_price == entry_price,
            Trade.quantity == quantity,
            Trade.entry_time == entry_time,
            Trade.status != "deleted",
        )
        if user_id is not None:
            q = q.filter(Trade.user_id == user_id)
        if exit_price is None:
            q = q.filter(Trade.exit_price.is_(None))
        else:
            q = q.filter(Trade.exit_price == exit_price)
        if exit_time is None:
            q = q.filter(Trade.exit_time.is_(None))
        else:
            q = q.filter(Trade.exit_time == exit_time)
        return q.first()

    def merge_or_create(self, trade_data: dict, allow_merge: bool = False) -> Tuple[Trade, str]:
        """Create a new trade, or merge with existing when allow_merge=True.

        By default (allow_merge=False), always creates a new trade.
        This prevents manual same-day trades from being silently merged.

        When allow_merge=True (broker import, Dhan sync), only merges if an
        existing trade matches the EXACT signature (symbol, entry_price,
        quantity, entry_time, exit_price, exit_time). Broader (symbol+date)
        matching is not used — that can collapse separate intraday trades.

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

        if not allow_merge:
            trade = Trade(**trade_data)
            trade.compute_pnl()
            self.db.add(trade)
            try:
                self.db.commit()
                self.db.refresh(trade)
                return trade, "created"
            except Exception:
                self.db.rollback()
                raise

        # Exact-duplicate merge for broker imports
        existing = self.get_by_exact_signature(
            symbol=trade_data["symbol"],
            entry_price=trade_data.get("entry_price"),
            quantity=trade_data.get("quantity"),
            entry_time=entry_time,
            exit_price=trade_data.get("exit_price"),
            exit_time=trade_data.get("exit_time"),
            user_id=trade_data.get("user_id"),
        )
        if existing:
            return existing, "merged"

        trade = Trade(**trade_data)
        trade.compute_pnl()
        self.db.add(trade)
        self.db.commit()
        self.db.refresh(trade)
        return trade, "created"

    def _merge_trade(self, existing: Trade, incoming: dict, defer_commit: bool = False) -> Trade:
        """Merge incoming trade data into existing trade (same symbol+date).

        Weighted-average entry/exit prices, sum quantities/fees/PnL,
        keep earliest entry_time, latest exit_time.

        If defer_commit=True, does NOT commit — caller controls the transaction.
        """
        old_qty = Decimal(str(existing.quantity or "0"))
        new_qty = Decimal(str(incoming.get("quantity", "0")))
        total_qty = old_qty + new_qty

        if total_qty > 0 and old_qty > 0 and incoming.get("entry_price"):
            existing.entry_price = (
                Decimal(str(existing.entry_price)) * old_qty
                + Decimal(str(incoming["entry_price"])) * new_qty
            ) / total_qty
        elif incoming.get("entry_price") and existing.entry_price is None:
            existing.entry_price = Decimal(str(incoming["entry_price"]))

        existing.quantity = total_qty

        incoming_time = incoming.get("entry_time")
        if incoming_time and incoming_time < existing.entry_time:
            existing.entry_time = incoming_time

        existing_exit = existing.exit_price
        incoming_exit = incoming.get("exit_price")
        if existing_exit is not None and incoming_exit is not None:
            existing.exit_price = (
                Decimal(str(existing_exit)) * old_qty
                + Decimal(str(incoming_exit)) * new_qty
            ) / total_qty
            exist_exit_time = existing.exit_time
            in_exit_time = incoming.get("exit_time")
            if in_exit_time and (not exist_exit_time or in_exit_time > exist_exit_time):
                existing.exit_time = in_exit_time
        elif incoming_exit is not None and existing_exit is None:
            existing.exit_price = Decimal(str(incoming_exit))
            existing.exit_time = incoming.get("exit_time")

        existing.fees = (existing.fees or Decimal("0")) + Decimal(str(incoming.get("fees", "0")))

        if existing.pnl is not None and incoming.get("pnl") is not None:
            existing.pnl = existing.pnl + Decimal(str(incoming["pnl"]))
        elif incoming.get("pnl") is not None and existing.pnl is None:
            existing.pnl = Decimal(str(incoming["pnl"]))
        else:
            existing.compute_pnl()

        if not defer_commit:
            self.db.commit()
            self.db.refresh(existing)
        return existing

    def pyramid_trade(self, trade_id: int, entry_price: Decimal, quantity: Decimal,
                      entry_time: Optional[datetime] = None,
                      fees: Optional[Decimal] = None,
                      stop_price: Optional[Decimal] = None,
                      user_id: Optional[int] = None) -> Trade:
        """Pyramid — add more shares to an open position.

        Updates entry price (weighted average), sums quantity, keeps earliest
        entry time, sums fees, optionally updates stop loss.
        Only allowed on OPEN trades (no exit).
        """
        q = self.db.query(Trade).filter(Trade.id == trade_id)
        if user_id is not None:
            q = q.filter(Trade.user_id == user_id)
        trade = q.first()
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

    def merge_duplicates(self, user_id: Optional[int] = None) -> int:
        """Find and merge trades with same (symbol, date, open/closed state).
        Reassigns child records, handles ExecutionGrade unique constraint,
        and commits atomically. Each kept trade gets compute_pnl called.
        Returns count of merged duplicates."""
        from collections import defaultdict
        from app.models.trade_timeline import TradeTimeline
        from app.models.emotion_log import EmotionLog
        from app.models.execution_grade import ExecutionGrade
        from app.models.stop_history import StopHistory

        q = self.db.query(Trade).filter(Trade.status != 'deleted')
        if user_id is not None:
            q = q.filter(Trade.user_id == user_id)
        trades = q.all()
        groups = defaultdict(list)
        for t in trades:
            state = "open" if t.exit_price is None else "closed"
            key = (t.symbol, t.entry_time.date(), state)
            groups[key].append(t)

        merged_count = 0
        kept_trade_ids = set()
        for key, group in groups.items():
            if len(group) <= 1:
                continue
            group.sort(key=lambda t: t.entry_time)
            keep = group[0]
            kept_trade_ids.add(keep.id)
            for dup in group[1:]:
                dup_data = {
                    "symbol": dup.symbol,
                    "direction": dup.direction,
                    "entry_price": str(dup.entry_price),
                    "quantity": str(dup.quantity),
                    "entry_time": dup.entry_time,
                    "exit_price": str(dup.exit_price) if dup.exit_price is not None else None,
                    "exit_time": dup.exit_time,
                    "fees": str(dup.fees or "0"),
                    "setup": dup.setup,
                    "tactic": dup.tactic,
                    "stop_price": str(dup.stop_price) if dup.stop_price is not None else None,
                    "target_price": str(dup.target_price) if dup.target_price is not None else None,
                    "status": dup.status,
                    "notes": dup.notes,
                }
                if dup.tags:
                    if keep.tags:
                        existing_tags = keep.tags if isinstance(keep.tags, list) else [keep.tags]
                        dup_tags = dup.tags if isinstance(dup.tags, list) else [dup.tags]
                        keep.tags = list(set(existing_tags + dup_tags))
                    else:
                        keep.tags = dup.tags

                self._merge_trade(keep, dup_data, defer_commit=True)

                self.db.query(PartialExit).filter(PartialExit.trade_id == dup.id).update({"trade_id": keep.id})
                self.db.query(TradeTimeline).filter(TradeTimeline.trade_id == dup.id).update({"trade_id": keep.id})
                self.db.query(EmotionLog).filter(EmotionLog.trade_id == dup.id).update({"trade_id": keep.id})
                self.db.query(StopHistory).filter(StopHistory.trade_id == dup.id).update({"trade_id": keep.id})

                # ExecutionGrade has unique trade_id — delete duplicate if keep already has one
                dup_grade = self.db.query(ExecutionGrade).filter(ExecutionGrade.trade_id == dup.id).first()
                if dup_grade:
                    keep_grade = self.db.query(ExecutionGrade).filter(ExecutionGrade.trade_id == keep.id).first()
                    if keep_grade:
                        # Both have grades — discard the duplicate's grade (keep wins)
                        self.db.delete(dup_grade)
                        self.db.flush()
                    else:
                        # Only dup has a grade — reassign to kept trade before deleting dup
                        dup_grade.trade_id = keep.id
                        self.db.flush()

                self.db.delete(dup)
                merged_count += 1

        # Recompute P&L for every kept trade that absorbed duplicates
        for tid in kept_trade_ids:
            trade = self.db.query(Trade).filter(Trade.id == tid).first()
            if trade:
                trade.compute_pnl()

        if merged_count > 0:
            self.db.commit()
        return merged_count

    def create_from_dhan_leg(self, leg, direction: str = "LONG", is_open: bool = True, user_id: Optional[int] = None) -> Trade:
        """Map a Dhan trade leg to our Trade model."""
        if user_id is None:
            raise ValueError("user_id required for Dhan trade creation")
        entry_price = None
        exit_price = None
        entry_time = None
        exit_time = None
        if is_open:
            entry_price = Decimal(str(leg.price))
            entry_time = _to_ist_naive(datetime.fromisoformat(leg.order_timestamp.replace("Z", "+00:00")))
        else:
            exit_price = Decimal(str(leg.price))
            exit_time = _to_ist_naive(datetime.fromisoformat(leg.order_timestamp.replace("Z", "+00:00")))

        trade_data = {
            "symbol": leg.trading_symbol,
            "direction": direction,
            "entry_price": entry_price,
            "exit_price": exit_price,
            "quantity": Decimal(str(leg.quantity)),
            "entry_time": entry_time,
            "exit_time": exit_time,
            "fees": Decimal("0"),
            "status": "open",
            "user_id": user_id,
        }
        trade, _ = self.merge_or_create(trade_data, allow_merge=True)
        return trade

    def find_or_create_pair(self, open_leg, close_leg, direction: str = "LONG", user_id: Optional[int] = None) -> Trade:
        """Match OPEN and CLOSE legs into a single trade, merging by (symbol, date)."""
        if user_id is None:
            raise ValueError("user_id required for Dhan trade creation")
        entry_time = _to_ist_naive(datetime.fromisoformat(open_leg.order_timestamp.replace("Z", "+00:00")))
        exit_time = _to_ist_naive(datetime.fromisoformat(close_leg.order_timestamp.replace("Z", "+00:00"))) if close_leg else None

        trade_data = {
            "symbol": open_leg.trading_symbol,
            "direction": direction,
            "entry_price": Decimal(str(open_leg.price)),
            "exit_price": Decimal(str(close_leg.price)) if close_leg else None,
            "quantity": Decimal(str(open_leg.quantity)),
            "entry_time": entry_time,
            "exit_time": exit_time,
            "fees": Decimal("0"),
            "status": "open",
            "user_id": user_id,
        }
        trade, _ = self.merge_or_create(trade_data, allow_merge=True)
        return trade
