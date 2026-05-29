"""Tapetide historical candle provider.

Fetches daily and weekly OHLCV data via the Tapetide MCP price_history tool.
Tapetide supports daily/weekly intervals only — NOT intraday (1m/5m/15m/30m/1h).

Timestamps are stored as naive IST (start-of-day for daily candles).
"""
import httpx
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)

IST = ZoneInfo("Asia/Kolkata")

SUPPORTED_TIMEFRAMES = {"1d", "1w"}


class TapetideNotConfigured(Exception):
    pass


class TapetideProviderError(Exception):
    pass


def build_tapetide_symbol(symbol: str) -> str:
    """Build Tapetide-compatible symbol from trade symbol.

    Tapetide MCP expects plain symbols (e.g. 'RELIANCE') without
    exchange prefix. Strip 'NSE:' or '.NS' suffixes since Tapetide
    auto-detects the exchange.
    """
    if ":" in symbol:
        symbol = symbol.split(":", 1)[1]
    if "." in symbol:
        symbol = symbol.rsplit(".", 1)[0]
    return symbol


def fetch_price_history(
    symbol: str,
    timeframe: str,
    start: datetime,
    end: datetime,
) -> List[dict]:
    if timeframe not in SUPPORTED_TIMEFRAMES:
        raise ValueError(
            f"Tapetide supports daily/weekly candles only (got '{timeframe}'). "
            "Use Dhan for intraday candles."
        )

    if not settings.TAPETIDE_ENABLED or not settings.TAPETIDE_API_KEY:
        raise TapetideNotConfigured(
            "Tapetide is not configured. Add TAPETIDE_API_KEY to enable daily charts."
        )

    tapetide_symbol = build_tapetide_symbol(symbol)
    interval = "weekly" if timeframe == "1w" else "daily"
    days = max(1, (end.date() - start.date()).days + 1)

    # Build JSON-RPC request for MCP price_history tool
    request_id = 1
    payload = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "tools/call",
        "params": {
            "name": "get_price_history",
            "arguments": {
                "symbol": tapetide_symbol,
                "interval": interval,
                "days": days,
            },
        },
    }

    try:
        resp = httpx.post(
            settings.TAPETIDE_MCP_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.TAPETIDE_API_KEY}",
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
            timeout=30.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise TapetideProviderError(
            f"Tapetide returned HTTP {exc.response.status_code}. "
            "Price history could not be loaded."
        ) from exc
    except httpx.RequestError as exc:
        raise TapetideProviderError(
            "Tapetide price history could not be loaded right now."
        ) from exc

    return _parse_tapetide_response(resp.json(), symbol, timeframe)


def _parse_tapetide_response(
    response: dict, symbol: str, timeframe: str
) -> List[dict]:
    """Parse Tapetide MCP JSON-RPC response into candle dicts.

    Handles these response shapes:
    1. result.content[0].text containing JSON string
    2. result.data containing candle list
    3. Direct list of candles (data field at top level)
    4. result with 'prices' or 'history' key
    """
    # Check for JSON-RPC error first
    if "error" in response:
        err = response["error"]
        msg = err.get("message", "Unknown error") if isinstance(err, dict) else str(err)
        raise TapetideProviderError(f"Tapetide API error: {msg}")

    candles_raw: list | None = None

    # Try result.content[0].text (standard MCP tool response)
    result = response.get("result")
    if isinstance(result, dict):
        # Check MCP error flag
        if result.get("isError"):
            content = result.get("content", [])
            err_text = ""
            if content and isinstance(content[0], dict):
                err_text = content[0].get("text", "")
            raise TapetideProviderError(
                f"Tapetide returned an error: {err_text[:200]}"
            )

        content = result.get("content")
        if isinstance(content, list) and len(content) > 0:
            text = content[0].get("text", "")
            if text:
                # Handle text that starts with "Error:" (non-JSON error)
                if text.strip().startswith("Error:"):
                    raise TapetideProviderError(
                        f"Tapetide returned an error: {text[:200]}"
                    )

                import json

                try:
                    parsed = json.loads(text)
                    if isinstance(parsed, dict):
                        candles_raw = parsed.get("data") or parsed.get("prices") or parsed.get("history")
                    elif isinstance(parsed, list):
                        candles_raw = parsed
                except (json.JSONDecodeError, TypeError):
                    pass

        # Try result.data
        if candles_raw is None and "data" in result:
            maybe_data = result["data"]
            if isinstance(maybe_data, list):
                candles_raw = maybe_data

    # Try top-level data
    if candles_raw is None:
        top_data = response.get("data")
        if isinstance(top_data, list):
            candles_raw = top_data

    if candles_raw is None:
        raise TapetideProviderError(
            "Tapetide returned an unexpected response format. No candle data found."
        )

    candles: List[dict] = []
    for row in candles_raw:
        try:
            date_str = row.get("date") or row.get("timestamp") or row.get("time", "")
            if not date_str:
                continue

            dt = _parse_timestamp(date_str, timeframe)

            candles.append({
                "symbol": symbol,
                "timeframe": timeframe,
                "timestamp": dt,
                "open": Decimal(str(row.get("open", 0))),
                "high": Decimal(str(row.get("high", 0))),
                "low": Decimal(str(row.get("low", 0))),
                "close": Decimal(str(row.get("close", 0))),
                "volume": row.get("volume"),
                "source": "tapetide",
            })
        except (KeyError, ValueError, TypeError) as exc:
            logger.warning("tapetide_parse_row_skip", error=str(exc), row=str(row)[:100])
            continue

    return candles


def _parse_timestamp(date_str: str, timeframe: str) -> datetime:
    """Convert Tapetide date string to naive IST datetime at start of day/week."""
    # Handles: "2024-06-15", "2024-06-15T10:30:00", "2024-06-15T10:30:00+05:30"
    cleaned = date_str.strip()

    # ISO with timezone
    if "+" in cleaned[10:] or cleaned.endswith("Z"):
        dt = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
        dt = dt.astimezone(IST).replace(tzinfo=None)
        return dt

    # ISO without timezone
    if "T" in cleaned:
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is not None:
            dt = dt.astimezone(IST).replace(tzinfo=None)
        return dt

    # Date only — start of day in IST
    dt = datetime.strptime(cleaned[:10], "%Y-%m-%d")
    return dt