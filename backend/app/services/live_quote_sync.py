from __future__ import annotations

from datetime import datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.live_quote import LiveQuote
from app.models.trade import Trade
from app.services.market_data_service import fetch_live_quotes
from app.utils.logging import get_logger

logger = get_logger(__name__)

IST = ZoneInfo("Asia/Kolkata")
LIVE_QUOTE_STALE_AFTER_SECONDS = 15 * 60


def is_market_open(now: datetime | None = None) -> bool:
    current = now or datetime.now(IST)
    if current.tzinfo is None:
        current = current.replace(tzinfo=IST)
    else:
        current = current.astimezone(IST)

    if current.weekday() >= 5:
        return False

    current_time = current.time()
    return time(9, 15) <= current_time <= time(15, 30)


def get_open_trade_symbols(db: Session) -> list[str]:
    rows = (
        db.query(Trade.symbol)
        .filter(
            Trade.status != "deleted",
            Trade.exit_price.is_(None),
            Trade.symbol.isnot(None),
        )
        .distinct()
        .order_by(Trade.symbol)
        .all()
    )
    return [symbol for (symbol,) in rows if symbol]


def _to_decimal(value: object) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except Exception:
        return None


def _upsert_live_quote(db: Session, quote: dict) -> None:
    symbol = quote.get("symbol")
    if not symbol:
        raise ValueError("missing symbol in fetched quote")

    existing = db.query(LiveQuote).filter(LiveQuote.symbol == symbol).first()
    if not existing:
        existing = LiveQuote(symbol=symbol)
        db.add(existing)

    for field in ("company_name", "ltp", "change", "change_pct", "volume"):
        if field not in quote or quote[field] is None:
            continue
        value = quote[field]
        if field != "company_name":
            value = _to_decimal(value)
        setattr(existing, field, value)


def sync_open_trade_quotes(db: Session) -> dict:
    symbol_list = get_open_trade_symbols(db)
    if not symbol_list:
        return {
            "symbols": [],
            "count": 0,
            "fetched": 0,
            "upserted": 0,
            "errors": [],
            "provider_status": "not_synced",
            "stale_after_seconds": LIVE_QUOTE_STALE_AFTER_SECONDS,
            "message": "No tracked symbols found. Add trades first.",
        }

    fetched_quotes, errors = fetch_live_quotes(symbol_list)

    upserted = 0
    for quote in fetched_quotes:
        try:
            _upsert_live_quote(db, quote)
            upserted += 1
        except Exception as exc:
            errors.append(f"row ({quote.get('symbol', '?')}): {exc}")

    db.commit()

    provider_status = (
        "fresh" if upserted == len(symbol_list) and not errors
        else "partial" if upserted
        else "failed" if errors
        else "not_synced"
    )

    summary = {
        "symbols": symbol_list,
        "count": len(symbol_list),
        "fetched": len(fetched_quotes),
        "upserted": upserted,
        "errors": errors,
        "provider_status": provider_status,
        "stale_after_seconds": LIVE_QUOTE_STALE_AFTER_SECONDS,
        "message": f"Synced {upserted}/{len(symbol_list)} symbols" if upserted else "No quotes fetched from provider",
    }

    logger.info(
        "sync_quotes_complete",
        symbols=symbol_list,
        fetched=summary["fetched"],
        upserted=upserted,
        errors=len(errors),
        provider_status=provider_status,
    )
    return summary
