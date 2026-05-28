"""Trade domain service for business logic."""
import hashlib
import json
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

    # ─── Lookups ─────────────────────────

    def get_by_import_fingerprint(self, user_id: int, fingerprint: str) -> Optional[Trade]:
        """Find existing trade by import fingerprint."""
        if not fingerprint:
            return None
        return self.db.query(Trade).filter(
            Trade.user_id == user_id,
            Trade.import_fingerprint == fingerprint,
        ).first()

    def get_by_external_order_id(self, user_id: int, external_order_id: str, symbol: str) -> Optional[Trade]:
        """Find existing trade by broker order/trade ID."""
        if not external_order_id:
            return None
        return self.db.query(Trade).filter(
            Trade.user_id == user_id,
            Trade.external_order_id == external_order_id,
            Trade.symbol == symbol,
        ).first()

    def get_by_exact_signature(self, symbol: str, entry_price, quantity, entry_time, exit_price=None, exit_time=None, user_id: Optional[int] = None) -> Optional[Trade]:
        """Find existing trade by exact identity: symbol + entry_price + qty + entry_time + exit_time."""
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

    # ─── Fingerprints ─────────────────────────

    @staticmethod
    def compute_fingerprint(trade_data: dict) -> str:
        """Deterministic SHA-256 fingerprint for deduplication.
        Includes source + normalized canonical fields. Excludes mutable fields (notes/tags).
        """
        source = trade_data.get("import_source") or "unknown"
        ext_id = trade_data.get("external_order_id") or ""

        payload = {
            "source": source,
            "external_order_id": ext_id,
            "user_id": trade_data.get("user_id") or "",
            "symbol": (trade_data.get("symbol") or "").upper(),
            "direction": (trade_data.get("direction") or "LONG").upper(),
            "entry_price": str(trade_data.get("entry_price") or "0"),
            "quantity": str(trade_data.get("quantity") or "0"),
            "entry_time": trade_data.get("entry_time").isoformat() if isinstance(trade_data.get("entry_time"), datetime) else str(trade_data.get("entry_time") or ""),
            "exit_price": str(trade_data.get("exit_price") or "0"),
            "exit_time": trade_data.get("exit_time").isoformat() if isinstance(trade_data.get("exit_time"), datetime) else str(trade_data.get("exit_time") or ""),
        }
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    # ─── Core import API ─────────────────────────

    def preview_import_decision(self, trade_data: dict) -> str:
        """Determine import decision without mutating DB. Returns 'import' | 'skip'.
        Checks same dedup chain as import_trade (fingerprint → external_order_id → exact_signature)."""
        user_id = trade_data.get("user_id")
        if not user_id:
            return "import"

        fingerprint = self.compute_fingerprint(trade_data)

        # 1. fingerprint duplicate
        if self.get_by_import_fingerprint(user_id, fingerprint):
            return "skipped"

        # 2. external_order_id duplicate
        ext_id = trade_data.get("external_order_id")
        if ext_id:
            if self.get_by_external_order_id(user_id, ext_id, trade_data.get("symbol", "")):
                return "skipped"

        # 3. exact signature fallback
        entry_time = trade_data.get("entry_time")
        if entry_time:
            if self.get_by_exact_signature(
                symbol=trade_data["symbol"],
                entry_price=trade_data.get("entry_price"),
                quantity=trade_data.get("quantity"),
                entry_time=entry_time,
                exit_price=trade_data.get("exit_price"),
                exit_time=trade_data.get("exit_time"),
                user_id=user_id,
            ):
                return "skipped"

        return "import"

    def import_trade(self, trade_data: dict, defer_commit: bool = False) -> Tuple[Trade, str, dict]:
        """Import-aware create/update with idempotency.

        Tries in order:
        1. import_fingerprint exact dup → skip (return existing, 'merged')
        2. external_order_id exists → check conflict, maybe update
        3. exact_signature fallback → skip (return existing, 'merged')
        4. create new

        Returns (trade, action, info_dict).
        Action: 'created' | 'merged' | 'updated'
        """
        user_id = trade_data.get("user_id")
        if not user_id:
            raise ValueError("user_id required for import")

        fingerprint = self.compute_fingerprint(trade_data)
        trade_data["import_fingerprint"] = fingerprint

        # 1. fingerprint exact duplicate
        existing_fp = self.get_by_import_fingerprint(user_id, fingerprint)
        if existing_fp:
            return existing_fp, "merged", {"reason": "import_fingerprint_duplicate"}

        # 2. external_order_id match
        ext_id = trade_data.get("external_order_id")
        if ext_id:
            existing_ext = self.get_by_external_order_id(user_id, ext_id, trade_data.get("symbol", ""))
            if existing_ext:
                # Conflict: same external ID but different fingerprint → log, skip update of money fields silently
                return existing_ext, "merged", {"reason": "external_order_id_duplicate"}

        # 3. exact signature fallback
        entry_time = trade_data.get("entry_time")
        if entry_time:
            existing = self.get_by_exact_signature(
                symbol=trade_data["symbol"],
                entry_price=trade_data.get("entry_price"),
                quantity=trade_data.get("quantity"),
                entry_time=entry_time,
                exit_price=trade_data.get("exit_price"),
                exit_time=trade_data.get("exit_time"),
                user_id=user_id,
            )
            if existing:
                # Backfill fingerprint + source on the existing trade so next import hits fingerprint
                if not existing.import_fingerprint:
                    existing.import_fingerprint = fingerprint
                    existing.import_source = trade_data.get("import_source")
                return existing, "merged", {"reason": "exact_signature_duplicate"}

        # 4. create
        trade = Trade(**trade_data)
        trade.compute_pnl()
        self.db.add(trade)
        if not defer_commit:
            self.db.commit()
            self.db.refresh(trade)
        return trade, "created", {}

    def create_manual_trade(self, trade_data: dict) -> Trade:
        """Manual creation — never merges, always creates new."""
        trade = Trade(**trade_data)
        trade.compute_pnl()
        self.db.add(trade)
        self.db.commit()
        self.db.refresh(trade)
        return trade

    # ─── Legacy wrappers ─────────────────────────

    def merge_or_create(self, trade_data: dict, allow_merge: bool = False) -> Tuple[Trade, str]:
        """Deprecated. Use import_trade() for imports; create_manual_trade() for manual.
        Kept for backward-compat."""
        entry_time = trade_data.get("entry_time")
        if not entry_time:
            trade = Trade(**trade_data)
            trade.compute_pnl()
            self.db.add(trade)
            self.db.commit()
            self.db.refresh(trade)
            return trade, "created"

        if not allow_merge:
            return self.create_manual_trade(trade_data), "created"

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

    # ─── Pyramid ─────────────────────────

    def pyramid_trade(self, trade_id: int, entry_price: Decimal, quantity: Decimal,
                      entry_time: Optional[datetime] = None,
                      fees: Optional[Decimal] = None,
                      stop_price: Optional[Decimal] = None,
                      user_id: Optional[int] = None) -> Trade:
        """Pyramid — add more shares to an open position."""
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

    # ─── merge_duplicates (disabled route but preserved method) ─────────────────────────

    def merge_duplicates(self, user_id: Optional[int] = None) -> int:
        """Find and merge trades with same (symbol, date, open/closed state) manually.
        Reassigns child records. Commits atomically."""
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
            groups[(t.symbol, t.entry_time.date(), state)].append(t)

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

                dup_grade = self.db.query(ExecutionGrade).filter(ExecutionGrade.trade_id == dup.id).first()
                if dup_grade:
                    keep_grade = self.db.query(ExecutionGrade).filter(ExecutionGrade.trade_id == keep.id).first()
                    if keep_grade:
                        self.db.delete(dup_grade)
                        self.db.flush()
                    else:
                        dup_grade.trade_id = keep.id
                        self.db.flush()

                self.db.delete(dup)
                merged_count += 1

        for tid in kept_trade_ids:
            trade = self.db.query(Trade).filter(Trade.id == tid).first()
            if trade:
                trade.compute_pnl()

        if merged_count > 0:
            self.db.commit()
        return merged_count

    def _merge_trade(self, existing: Trade, incoming: dict, defer_commit: bool = False) -> Trade:
        """Merge incoming into existing (same symbol+date). Weighted-average prices, sum qty/fees."""
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
        elif incoming_exit is not None and existing.exit_price is None:
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

    # ─── Dhan helpers ─────────────────────────

    def create_from_dhan_leg(self, leg, direction: str = "LONG", is_open: bool = True, user_id: Optional[int] = None, import_source: str = "dhan_sync") -> Trade:
        """Map Dhan trade leg to Trade model."""
        if user_id is None:
            raise ValueError("user_id required for Dhan trade creation")
        entry_price = None
        exit_price = None
        entry_time = None
        exit_time = None

        raw_ts = leg.order_timestamp.replace("Z", "+00:00")
        dt = _to_ist_naive(datetime.fromisoformat(raw_ts))

        if is_open:
            entry_price = Decimal(str(leg.price))
            entry_time = dt
        else:
            exit_price = Decimal(str(leg.price))
            exit_time = dt

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
            "external_order_id": leg.exchange_order_id,
            "import_source": import_source,
        }
        trade, action, _ = self.import_trade(trade_data)
        return trade

    def find_or_create_pair(self, open_leg, close_leg, direction: str = "LONG", user_id: Optional[int] = None, import_source: str = "dhan_sync") -> Trade:
        """Match OPEN and CLOSE legs into a single trade."""
        if user_id is None:
            raise ValueError("user_id required for Dhan trade creation")

        raw_ts_open = open_leg.order_timestamp.replace("Z", "+00:00")
        entry_time = _to_ist_naive(datetime.fromisoformat(raw_ts_open))

        exit_time = None
        if close_leg:
            raw_ts_close = close_leg.order_timestamp.replace("Z", "+00:00")
            exit_time = _to_ist_naive(datetime.fromisoformat(raw_ts_close))

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
            "external_order_id": open_leg.exchange_order_id,
            "import_source": import_source,
        }
        trade, action, _ = self.import_trade(trade_data)
        return trade
