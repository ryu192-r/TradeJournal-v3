"""Dhan historical candle provider.

Stub implementation — Dhan v2 API historical OHLC endpoint details
are not yet confirmed. When available, implement fetch_historical_candles()
to call the real API.

Until then, calling this module raises HistoricalDataNotConfigured.
"""
import os
from datetime import datetime
from typing import List, Optional

from app.utils.logging import get_logger

logger = get_logger(__name__)


class HistoricalDataNotConfigured(Exception):
    """Raised when no historical candle provider is configured."""
    pass


DHAN_CLIENT_ID = os.environ.get("DHAN_CLIENT_ID", "")
DHAN_ACCESS_TOKEN = os.environ.get("DHAN_ACCESS_TOKEN", "")


def fetch_historical_candles(
    symbol: str,
    timeframe: str,
    start: datetime,
    end: datetime,
) -> List[dict]:
    """Fetch historical OHLC candles from Dhan API.

    Returns list of dicts with keys:
        symbol, timeframe, timestamp, open, high, low, close, volume

    Raises HistoricalDataNotConfigured if Dhan credentials are not set.
    """
    if not DHAN_CLIENT_ID or not DHAN_ACCESS_TOKEN:
        raise HistoricalDataNotConfigured(
            "Dhan API credentials not configured. Set DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN."
        )

    # Dhan historical candle API endpoint is not yet implemented.
    # When Dhan provides v2 OHLC endpoint, map timeframe -> Dhan interval
    # and call the API here.
    #
    # Example mapping:
    # timeframe_map = {
    #     "1m": "1", "3m": "3", "5m": "5", "15m": "15",
    #     "30m": "30", "1h": "60", "1d": "DAY",
    # }
    #
    # URL: f"https://api.dhan.co/v2/chartdata/intraday/{symbol}"
    # or  f"https://api.dhan.co/v2/chartdata/historical/{symbol}"

    raise HistoricalDataNotConfigured(
        "Dhan historical candle endpoint not yet implemented. "
        "Falling back to cache or mock data."
    )