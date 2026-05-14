"""Dhan API client for trade history sync."""
import os
import time
from datetime import date
from typing import List, Optional
from decimal import Decimal

import requests
from pydantic import BaseModel, Field


class DhanTradeLeg(BaseModel):
    """Single trade leg from Dhan API."""
    exchange: str
    segment: str
    security_id: str
    trading_symbol: str = Field(..., alias="tradingSymbol")
    transaction_type: str = Field(..., alias="transactionType")
    quantity: int = Field(..., alias="tradedQuantity")
    price: Decimal = Field(..., alias="tradedPrice")
    product_type: str = Field(..., alias="productType")
    order_timestamp: str = Field(..., alias="orderDateTime")
    exchange_order_id: str = Field(..., alias="exchangeOrderId")
    leg_type: str = Field(..., alias="legType")  # OPEN or CLOSE

    class Config:
        populate_by_name = True


class DhanDayTrades(BaseModel):
    """All trades for a single day from Dhan."""
    dhan_client_id: str = Field(..., alias="dhanClientId")
    trades: List[DhanTradeLeg]


class DhanSyncService:
    """Service for syncing trades from Dhan broker."""

    BASE_URL = "https://api.dhan.co"
    RATE_LIMIT = 60  # requests per minute max

    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token or os.environ.get("DHAN_ACCESS_TOKEN", "")
        self._last_request_at = 0.0

    def _request(self, method: str, path: str, params=None) -> dict:
        # Rate limit: 60 req/min = 1 req/sec min gap
        elapsed = time.time() - self._last_request_at
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)

        url = f"{self.BASE_URL}{path}"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }
        resp = requests.request(method, url, headers=headers, params=params, timeout=30)
        self._last_request_at = time.time()
        resp.raise_for_status()
        return resp.json()

    def get_daily_trades(self, day: date) -> DhanDayTrades:
        """Fetch all trade legs for a single day."""
        path = f"/trades/{day.strftime('%Y-%m-%d')}"
        data = self._request("GET", path)
        return DhanDayTrades(**data)

    def get_range_trades(self, from_date: date, to_date: date) -> List[DhanDayTrades]:
        """Fetch trades for a date range. Pure API fetcher — no DB access."""
        from datetime import timedelta

        results: List[DhanDayTrades] = []
        cursor = from_date
        while cursor <= to_date:
            try:
                day_data = self.get_daily_trades(cursor)
                results.append(day_data)
            except requests.HTTPError as e:
                if e.response.status_code == 404:
                    pass
                else:
                    raise
            cursor += timedelta(days=1)
        return results
