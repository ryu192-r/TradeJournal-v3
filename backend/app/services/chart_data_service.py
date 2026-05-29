"""Market candle service — cache, provider abstraction, chart data assembly."""
import hashlib
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.market_candle import MarketCandle
from app.models.trade import Trade
from app.models.partial_exit import PartialExit
from app.schemas.chart import (
    CandleResponse, ChartMarkerResponse, PriceLineResponse,
    ChartAnnotationsResponse, ChartMetaResponse, ChartDataResponse,
)
from app.core.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)

IST = ZoneInfo("Asia/Kolkata")

VALID_TIMEFRAMES = {"1m", "3m", "5m", "15m", "30m", "1h", "1d", "1w"}
VALID_RANGES = {"auto", "1d", "5d", "1mo", "3mo", "6mo", "1y"}
VALID_SOURCES = {"auto", "cache", "tapetide", "dhan", "mock"}

MAX_CANDLES = 5000


def validate_timeframe(timeframe: str) -> str:
    if timeframe not in VALID_TIMEFRAMES:
        raise ValueError(f"Invalid timeframe '{timeframe}'. Allowed: {sorted(VALID_TIMEFRAMES)}")
    return timeframe


def validate_range(range_: str) -> str:
    if range_ not in VALID_RANGES:
        raise ValueError(f"Invalid range '{range_}'. Allowed: {sorted(VALID_RANGES)}")
    return range_


def validate_source(source: str) -> str:
    if source not in VALID_SOURCES:
        raise ValueError(f"Invalid source '{source}'. Allowed: {sorted(VALID_SOURCES)}")
    return source


def is_daily_timeframe(timeframe: str) -> bool:
    return timeframe in {"1d", "1w"}


def _timeframe_to_timedelta(tf: str) -> timedelta:
    _mapping = {
        "1m": timedelta(minutes=1),
        "3m": timedelta(minutes=3),
        "5m": timedelta(minutes=5),
        "15m": timedelta(minutes=15),
        "30m": timedelta(minutes=30),
        "1h": timedelta(hours=1),
        "1d": timedelta(days=1),
        "1w": timedelta(weeks=1),
    }
    return _mapping[tf]


def _range_to_timedelta(range_: str) -> timedelta:
    mapping = {
        "1d": timedelta(days=1),
        "5d": timedelta(days=5),
        "1mo": timedelta(days=30),
        "3mo": timedelta(days=90),
        "6mo": timedelta(days=180),
        "1y": timedelta(days=365),
    }
    return mapping.get(range_, timedelta(days=30))


def get_trade_chart_window(trade: Trade, range_: str) -> Tuple[datetime, datetime]:
    """Compute start/end for chart data based on trade and range."""
    entry = trade.entry_time
    if entry.tzinfo is not None:
        entry = entry.astimezone(IST).replace(tzinfo=None)

    if range_ == "auto":
        is_daily = False
        if trade.exit_time is not None:
            exit_t = trade.exit_time
            if exit_t.tzinfo is not None:
                exit_t = exit_t.astimezone(IST).replace(tzinfo=None)
            duration = (exit_t - entry).total_seconds()
            is_daily = duration > 86400 * 5

            if is_daily:
                start = entry - timedelta(days=30)
                end = exit_t + timedelta(days=30)
            else:
                start = entry - timedelta(days=1)
                end = exit_t + timedelta(days=1)
        else:
            now = datetime.now(IST).replace(tzinfo=None)
            duration = (now - entry).total_seconds()
            is_daily = duration > 86400 * 5

            if is_daily:
                start = entry - timedelta(days=30)
                end = now + timedelta(days=1)
            else:
                start = entry - timedelta(days=1)
                end = now + timedelta(hours=1)
    else:
        delta = _range_to_timedelta(range_)
        center = entry
        start = center - delta
        end = center + delta
        if trade.exit_time is not None:
            exit_t = trade.exit_time
            if exit_t.tzinfo is not None:
                exit_t = exit_t.astimezone(IST).replace(tzinfo=None)
            end = max(end, exit_t + timedelta(days=1))

    return start, end


def get_cached_candles(db: Session, symbol: str, timeframe: str, start: datetime, end: datetime) -> List[MarketCandle]:
    return (
        db.query(MarketCandle)
        .filter(
            MarketCandle.symbol == symbol,
            MarketCandle.timeframe == timeframe,
            MarketCandle.timestamp >= start,
            MarketCandle.timestamp <= end,
        )
        .order_by(MarketCandle.timestamp.asc())
        .all()
    )


def upsert_candles(db: Session, candles: List[dict], _commit: bool = True) -> int:
    """Insert or update candles. Commits by default; set _commit=False to let caller control the transaction."""
    added = 0
    for c in candles:
        existing = (
            db.query(MarketCandle)
            .filter(
                MarketCandle.symbol == c["symbol"],
                MarketCandle.timeframe == c["timeframe"],
                MarketCandle.timestamp == c["timestamp"],
                MarketCandle.source == c.get("source", "cache"),
            )
            .first()
        )
        if existing:
            existing.open = c["open"]
            existing.high = c["high"]
            existing.low = c["low"]
            existing.close = c["close"]
            existing.volume = c.get("volume")
        else:
            db.add(MarketCandle(
                symbol=c["symbol"],
                timeframe=c["timeframe"],
                timestamp=c["timestamp"],
                open=c["open"],
                high=c["high"],
                low=c["low"],
                close=c["close"],
                volume=c.get("volume"),
                source=c.get("source", "cache"),
            ))
            added += 1
    if candles and _commit:
        db.commit()
    return added


def _generate_mock_candles(trade: Trade, timeframe: str, start: datetime, end: datetime) -> List[CandleResponse]:
    """Deterministic mock candles for DEBUG mode only."""
    seed = int(hashlib.md5(f"{trade.symbol}{trade.id}{trade.entry_time}".encode()).hexdigest()[:8], 16)
    import random
    rng = random.Random(seed)

    delta = _timeframe_to_timedelta(timeframe)
    entry_price = float(trade.entry_price)
    candles = []
    current_time = start
    price = entry_price * rng.uniform(0.95, 1.05)

    while current_time <= end:
        change_pct = rng.gauss(0, 0.005)
        new_price = price * (1 + change_pct)
        if new_price < price * 0.7:
            new_price = price * 0.7
        candle_high = max(price, new_price) * rng.uniform(1.0, 1.003)
        candle_low = min(price, new_price) * rng.uniform(0.997, 1.0)
        vol = rng.randint(10000, 500000)

        candles.append(CandleResponse(
            time=int(current_time.timestamp()),
            open=round(price, 2),
            high=round(candle_high, 2),
            low=round(candle_low, 2),
            close=round(new_price, 2),
            volume=vol,
        ))
        price = new_price
        current_time = current_time + delta

        if len(candles) >= MAX_CANDLES:
            break

    return candles


def _dt_to_unix(dt: datetime) -> int:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return int(dt.timestamp())


def build_chart_markers(trade: Trade, partials: List[PartialExit], candle_times: List[int], timeframe: str = "5m") -> Tuple[List[ChartMarkerResponse], List[PriceLineResponse], ChartAnnotationsResponse]:
    """Build markers and price lines from trade data."""
    markers: List[ChartMarkerResponse] = []
    price_lines: List[PriceLineResponse] = []

    entry_ts = _dt_to_unix(trade.entry_time) if trade.entry_time else None

    max_snap_seconds = _timeframe_to_timedelta(timeframe).total_seconds() * 2
    if max_snap_seconds < 300:
        max_snap_seconds = 300

    def snap_to_candle(ts: int) -> int:
        if not candle_times:
            return ts
        best = min(candle_times, key=lambda c: abs(c - ts))
        if abs(best - ts) <= max_snap_seconds:
            return best
        return ts

    if entry_ts is not None:
        snapped = snap_to_candle(entry_ts)
        markers.append(ChartMarkerResponse(
            time=snapped,
            position="belowBar",
            shape="arrowUp",
            color="#16a34a",
            text=f"Entry {trade.entry_price} x {trade.quantity}",
        ))

    if trade.exit_price is not None and trade.exit_time is not None:
        exit_ts = _dt_to_unix(trade.exit_time)
        snapped = snap_to_candle(exit_ts)
        pnl_str = f" P&L {trade.pnl}" if trade.pnl is not None else ""
        markers.append(ChartMarkerResponse(
            time=snapped,
            position="aboveBar",
            shape="arrowDown",
            color="#dc2626",
            text=f"Exit {trade.exit_price}{pnl_str}",
        ))

    for pe in partials:
        if pe.exit_time is not None:
            pe_ts = _dt_to_unix(pe.exit_time)
            snapped = snap_to_candle(pe_ts)
            pnl_str = f" P&L {pe.realized_pnl}" if pe.realized_pnl is not None else ""
            markers.append(ChartMarkerResponse(
                time=snapped,
                position="aboveBar",
                shape="circle",
                color="#f59e0b",
                text=f"Partial {pe.qty} @ {pe.exit_price}{pnl_str}",
            ))

    if trade.stop_price is not None:
        price_lines.append(PriceLineResponse(
            price=float(trade.stop_price),
            title="Stop",
            color="#ef4444",
        ))

    if trade.target_price is not None:
        price_lines.append(PriceLineResponse(
            price=float(trade.target_price),
            title="Target",
            color="#22c55e",
        ))

    annotations = ChartAnnotationsResponse(
        entry_time=trade.entry_time.isoformat() if trade.entry_time else None,
        exit_time=trade.exit_time.isoformat() if trade.exit_time else None,
        partial_exits=[
            {"exit_time": pe.exit_time.isoformat() if pe.exit_time else None,
             "qty": str(pe.qty), "exit_price": str(pe.exit_price),
             "realized_pnl": str(pe.realized_pnl) if pe.realized_pnl is not None else None}
            for pe in partials
        ],
    )

    return markers, price_lines, annotations


def get_chart_data_for_trade(
    db: Session,
    trade: Trade,
    timeframe: str,
    range_: str,
    source: str,
) -> ChartDataResponse:
    """Main entry point — assemble chart data for a trade."""
    validate_timeframe(timeframe)
    validate_range(range_)

    start, end = get_trade_chart_window(trade, range_)

    partials = (
        db.query(PartialExit)
        .filter(PartialExit.trade_id == trade.id)
        .order_by(PartialExit.exit_time.asc())
        .all()
    )

    if source == "mock":
        if not settings.DEBUG:
            return ChartDataResponse(
                trade_id=trade.id,
                symbol=trade.symbol,
                timeframe=timeframe,
                range=range_,
                source="mock",
                meta=ChartMetaResponse(has_real_data=False, is_mock=False, message="Mock data only available in DEBUG mode"),
            )
        candles = _generate_mock_candles(trade, timeframe, start, end)
        candle_times = [c.time for c in candles]
        markers, price_lines, annotations = build_chart_markers(trade, partials, candle_times, timeframe)
        return ChartDataResponse(
            trade_id=trade.id,
            symbol=trade.symbol,
            timeframe=timeframe,
            range=range_,
            source="mock",
            candles=candles,
            markers=markers,
            price_lines=price_lines,
            annotations=annotations,
            meta=ChartMetaResponse(has_real_data=False, is_mock=True, message="Showing mock data for development"),
        )

    # Try cache first
    cached = get_cached_candles(db, trade.symbol, timeframe, start, end)

    source_used = "cache"
    candles_raw: list = []

    if cached:
        candles_raw = cached
        source_used = "cache"

    # Provider selection based on source and timeframe
    if source in ("auto", "tapetide") and is_daily_timeframe(timeframe):
        if not cached or source == "tapetide":
            try:
                from app.services.providers.tapetide_market_data import fetch_price_history
                fetched = fetch_price_history(trade.symbol, timeframe, start, end)
                if fetched:
                    upserted = upsert_candles(db, fetched, _commit=True)
                    logger.info("tapetide_candles_upserted", symbol=trade.symbol, count=upserted)
                    cached = get_cached_candles(db, trade.symbol, timeframe, start, end)
                    candles_raw = cached
                    source_used = "tapetide"
            except Exception as exc:
                from app.services.providers.tapetide_market_data import (
                    TapetideNotConfigured,
                )
                if isinstance(exc, TapetideNotConfigured):
                    if source == "tapetide" and not cached:
                        return ChartDataResponse(
                            trade_id=trade.id,
                            symbol=trade.symbol,
                            timeframe=timeframe,
                            range=range_,
                            source="tapetide",
                            meta=ChartMetaResponse(
                                has_real_data=False,
                                message="Tapetide is not configured. Add TAPETIDE_API_KEY to enable daily charts.",
                            ),
                        )
                logger.warning("tapetide_fetch_failed", symbol=trade.symbol, error=str(exc))
                if source == "tapetide" and not cached:
                    return ChartDataResponse(
                        trade_id=trade.id,
                        symbol=trade.symbol,
                        timeframe=timeframe,
                        range=range_,
                        source="tapetide",
                        meta=ChartMetaResponse(
                            has_real_data=False,
                            message="Tapetide price history could not be loaded right now.",
                        ),
                    )

    # Tapetide doesn't support intraday — friendly message
    if source == "tapetide" and not is_daily_timeframe(timeframe):
        return ChartDataResponse(
            trade_id=trade.id,
            symbol=trade.symbol,
            timeframe=timeframe,
            range=range_,
            source="tapetide",
            meta=ChartMetaResponse(
                has_real_data=False,
                message="Tapetide currently supports daily/weekly candles only. Use Dhan for intraday candles.",
            ),
        )

    # Attempt Dhan provider if enabled and source allows (intraday only for auto)
    if source in ("auto", "dhan") and (not candles_raw or source == "dhan") and not is_daily_timeframe(timeframe):
        try:
            from app.services.providers.dhan_market_data import fetch_historical_candles
            fetched = fetch_historical_candles(trade.symbol, timeframe, start, end)
            if fetched:
                upserted = upsert_candles(db, [
                    {**c, "source": "dhan"} for c in fetched
                ])
                logger.info("dhan_candles_upserted", symbol=trade.symbol, count=upserted)
                cached = get_cached_candles(db, trade.symbol, timeframe, start, end)
                candles_raw = cached
                source_used = "dhan"
        except Exception as exc:
            logger.warning("dhan_fetch_failed", symbol=trade.symbol, error=str(exc))
            if source == "dhan" and not cached:
                return ChartDataResponse(
                    trade_id=trade.id,
                    symbol=trade.symbol,
                    timeframe=timeframe,
                    range=range_,
                    source="dhan",
                    meta=ChartMetaResponse(has_real_data=False, message=f"Dhan provider error: {str(exc)}"),
                )

    # Convert to response
    candles: List[CandleResponse] = []
    for c in candles_raw[:MAX_CANDLES]:
        ts = c.timestamp
        if ts.tzinfo is not None:
            ts = ts.astimezone(IST).replace(tzinfo=None)
        candles.append(CandleResponse(
            time=int(ts.replace(tzinfo=IST).timestamp()) if ts.tzinfo is None else int(ts.timestamp()),
            open=float(c.open),
            high=float(c.high),
            low=float(c.low),
            close=float(c.close),
            volume=c.volume,
        ))

    candle_times = [c.time for c in candles]
    markers, price_lines, annotations = build_chart_markers(trade, partials, candle_times, timeframe)

    has_real = len(candles) > 0
    message = None
    if not has_real:
        if is_daily_timeframe(timeframe):
            message = "No candle data available. Configure Tapetide (TAPETIDE_API_KEY) for daily charts, or upload screenshots."
        else:
            message = "No candle data available. Intraday candles require Dhan (not yet available). Switch to 1D for Tapetide daily charts."

    return ChartDataResponse(
        trade_id=trade.id,
        symbol=trade.symbol,
        timeframe=timeframe,
        range=range_,
        source=source_used,
        candles=candles,
        markers=markers,
        price_lines=price_lines,
        annotations=annotations,
        meta=ChartMetaResponse(has_real_data=has_real, message=message),
    )