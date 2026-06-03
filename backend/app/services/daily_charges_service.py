"""Daily Charges Ledger Service."""
from datetime import date
from typing import Optional
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.daily_charges import DailyCharges
from app.models.trade import Trade
from app.utils.decimal_utils import ensure_decimal
from app.utils.trade_dates import get_realized_session_date


def _compute_total_charges(dc: DailyCharges) -> Decimal:
    if dc.entry_mode == "total_only":
        return ensure_decimal(dc.total_charges)
    return (
        ensure_decimal(dc.brokerage)
        + ensure_decimal(dc.stt)
        + ensure_decimal(dc.exchange_txn_charges)
        + ensure_decimal(dc.sebi_charges)
        + ensure_decimal(dc.stamp_duty)
        + ensure_decimal(dc.gst)
        + ensure_decimal(dc.clearing_charges)
        + ensure_decimal(dc.other_charges)
    )


def _day_gross_realized_pnl(db: Session, user_id: int, trade_date: date) -> tuple[Optional[Decimal], int]:
    """Returns (gross realized PnL, trade_count) for a user/date from closed trades.
    Partial realized PnL on open trades is intentionally excluded from day-level gross
    because it is not yet realized into equity on that day.
    """
    trades = (
        db.query(Trade)
        .filter(
            Trade.user_id == user_id,
            Trade.status == "closed",
            Trade.pnl.isnot(None),
        )
        .all()
    )
    total = Decimal("0")
    count = 0
    for t in trades:
        session_date = get_realized_session_date(t.exit_time, t.entry_time, t.created_at)
        if session_date == trade_date:
            total += ensure_decimal(t.pnl) + ensure_decimal(t.fees)
            count += 1
    if count == 0:
        return None, 0
    return total, count


class DailyChargesService:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def upsert(self, trade_date: date, payload: dict) -> DailyCharges:
        entry_mode = payload.get("entry_mode", "breakdown")
        if entry_mode == "total_only":
            tc = payload.get("total_charges")
            if tc is None or tc == "":
                raise ValueError("total_charges is required when entry_mode is total_only")
        existing = (
            self.db.query(DailyCharges)
            .filter(DailyCharges.user_id == self.user_id, DailyCharges.trade_date == trade_date)
            .first()
        )
        if existing:
            for k, v in payload.items():
                setattr(existing, k, v)
            existing.entry_mode = entry_mode
            existing.total_charges = _compute_total_charges(existing)
            self.db.commit()
            self.db.refresh(existing)
            return existing
        dc = DailyCharges(user_id=self.user_id, trade_date=trade_date, **payload)
        dc.entry_mode = entry_mode
        dc.total_charges = _compute_total_charges(dc)
        self.db.add(dc)
        self.db.commit()
        self.db.refresh(dc)
        return dc

    def get_by_date(self, trade_date: date) -> Optional[DailyCharges]:
        return (
            self.db.query(DailyCharges)
            .filter(DailyCharges.user_id == self.user_id, DailyCharges.trade_date == trade_date)
            .first()
        )

    def list_by_range(self, start_date: Optional[date], end_date: Optional[date]):
        query = self.db.query(DailyCharges).filter(DailyCharges.user_id == self.user_id)
        if start_date:
            query = query.filter(DailyCharges.trade_date >= start_date)
        if end_date:
            query = query.filter(DailyCharges.trade_date <= end_date)
        query = query.order_by(DailyCharges.trade_date.desc())
        total = query.count()
        return total, query.all()

    def delete_by_date(self, trade_date: date) -> None:
        dc = self.get_by_date(trade_date)
        if not dc:
            raise ValueError("Not found")
        if dc.user_id != self.user_id:
            raise PermissionError("Not allowed")
        self.db.delete(dc)
        self.db.commit()

    def summary(self, start_date: date, end_date: date) -> dict:
        """Compute per-day gross, charges, net across a date range."""
        charges_map = {
            dc.trade_date: dc
            for dc in (
                self.db.query(DailyCharges)
                .filter(
                    DailyCharges.user_id == self.user_id,
                    DailyCharges.trade_date >= start_date,
                    DailyCharges.trade_date <= end_date,
                )
                .all()
            )
        }

        # Identify which days in the range have closed trades with realized PnL
        trades = (
            self.db.query(Trade)
            .filter(
                Trade.user_id == self.user_id,
                Trade.status == "closed",
                Trade.pnl.isnot(None),
            )
            .all()
        )
        trading_days: set[date] = set()
        day_pnls: dict[date, Decimal] = {}
        day_counts: dict[date, int] = {}
        for t in trades:
            sd = get_realized_session_date(t.exit_time, t.entry_time, t.created_at)
            if sd is None:
                continue
            if start_date <= sd <= end_date:
                trading_days.add(sd)
                day_pnls[sd] = day_pnls.get(sd, Decimal("0")) + ensure_decimal(t.pnl)
                day_counts[sd] = day_counts.get(sd, 0) + 1

        days: list[dict] = []
        gross_total = Decimal("0")
        charges_total = Decimal("0")
        net_total = Decimal("0")
        recorded_days = 0
        missing_days = 0

        current = start_date
        from datetime import timedelta
        while current <= end_date:
            if current in trading_days:
                dc = charges_map.get(current)
                gross = day_pnls.get(current, Decimal("0"))
                if dc:
                    tc = ensure_decimal(dc.total_charges)
                    net = gross - tc
                    days.append({
                        "trade_date": current.isoformat(),
                        "gross_realized_pnl": str(gross),
                        "charges_recorded": True,
                        "total_charges": str(tc),
                        "net_realized_pnl": str(net),
                        "trade_count": day_counts.get(current, 0),
                        "entry_mode": dc.entry_mode,
                        "broker": dc.broker,
                    })
                    gross_total += gross
                    charges_total += tc
                    net_total += net
                    recorded_days += 1
                else:
                    days.append({
                        "trade_date": current.isoformat(),
                        "gross_realized_pnl": str(gross),
                        "charges_recorded": False,
                        "total_charges": None,
                        "net_realized_pnl": None,
                        "trade_count": day_counts.get(current, 0),
                    })
                    missing_days += 1
            current += timedelta(days=1)

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "gross_realized_pnl": str(gross_total) if trading_days else None,
            "total_charges": str(charges_total) if recorded_days > 0 else None,
            "net_realized_pnl": str(net_total) if recorded_days > 0 and trading_days else None,
            "charges_recorded_days": recorded_days,
            "trading_days": len(trading_days),
            "missing_charge_days": missing_days,
            "days": days,
        }
