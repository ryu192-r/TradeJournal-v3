"""HTTP client for backend REST API communication."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import httpx
import structlog

from config import BACKEND_URL

logger = structlog.get_logger()


class BackendClient:
    """Thin async HTTP client wrapping the backend REST API."""

    def __init__(self, base_url: str = BACKEND_URL) -> None:
        self.base_url = base_url.rstrip("/")
        self._client: httpx.AsyncClient | None = None

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=15.0)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def _request(
        self, method: str, path: str, *, params: dict | None = None, json: dict | None = None
    ) -> dict | list:
        url = f"{self.base_url}{path}"
        client = await self._ensure_client()
        logger.info("backend_request", method=method, url=url)
        resp = await client.request(method, url, params=params, json=json)
        resp.raise_for_status()
        data = resp.json()
        return data

    async def _get(self, path: str, params: dict | None = None) -> dict | list:
        return await self._request("GET", path, params=params)

    async def _post(self, path: str, json: dict) -> dict | list:
        return await self._request("POST", path, json=json)

    async def _put(self, path: str, json: dict) -> dict | list:
        return await self._request("PUT", path, json=json)

    # ─── Trades ──────────────────────────────────────────────

    async def create_trade(self, trade: dict[str, Any]) -> dict:
        payload = {k: v for k, v in trade.items() if v is not None}
        return await self._post("/trades/", json=payload)

    async def get_trade(self, trade_id: int) -> dict:
        return await self._get(f"/trades/{trade_id}")

    async def update_trade(self, trade_id: int, update: dict[str, Any]) -> dict:
        payload = {k: v for k, v in update.items() if v is not None}
        return await self._put(f"/trades/{trade_id}", json=payload)

    async def list_trades(
        self,
        *,
        limit: int = 100,
        status: str | None = None,
        symbol: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> list[dict]:
        params: dict[str, Any] = {"limit": limit}
        if status:
            params["status"] = status
        if symbol:
            params["symbol"] = symbol
        result = await self._get("/trades/", params=params)
        if isinstance(result, list):
            items = result
        elif isinstance(result, dict):
            items = result.get("items", result.get("data", []))
        else:
            items = []
        return self._filter_by_date(items, from_date, to_date)

    def _filter_by_date(
        self, items: list[dict], from_date: str | None, to_date: str | None
    ) -> list[dict]:
        if not from_date and not to_date:
            return items
        filtered = []
        for t in items:
            entry_str = t.get("entry_time", "")[:10]
            if from_date and entry_str < from_date:
                continue
            if to_date and entry_str > to_date:
                continue
            filtered.append(t)
        return filtered

    async def list_open_trades(self) -> list[dict]:
        return await self.list_trades(limit=500, status="open")

    async def list_closed_trades(self, days: int = 30) -> list[dict]:
        from_date = (date.today() - timedelta(days=days)).isoformat()
        return await self.list_trades(limit=500, status="closed", from_date=from_date)

    # ─── Dashboard ───────────────────────────────────────────

    async def get_operational_dashboard(self) -> dict:
        try:
            result = await self._get("/dashboard/operational")
            return result if isinstance(result, dict) else {}
        except (httpx.HTTPStatusError, Exception):
            return {}

    # ─── Analytics ───────────────────────────────────────────

    async def get_kpi(self) -> dict:
        try:
            result = await self._get("/analytics/kpi")
            return result if isinstance(result, dict) else {}
        except (httpx.HTTPStatusError, Exception):
            return {}

    async def get_daily_pnl(self, from_date: str | None = None) -> list[dict]:
        try:
            params = {"from_date": from_date} if from_date else None
            result = await self._get("/analytics/daily-pnl", params=params)
            return result if isinstance(result, list) else []
        except (httpx.HTTPStatusError, Exception):
            return []

    async def get_setup_performance(self) -> list[dict]:
        try:
            result = await self._get("/analytics/setup-performance")
            if isinstance(result, list):
                return result
            if isinstance(result, dict):
                return result.get("items", result.get("data", []))
            return []
        except (httpx.HTTPStatusError, Exception):
            return []

    async def get_streaks(self) -> dict:
        try:
            result = await self._get("/analytics/streaks")
            return result if isinstance(result, dict) else {}
        except (httpx.HTTPStatusError, Exception):
            return {}

    # ─── Journal ─────────────────────────────────────────────

    async def get_journal(self, date_str: str | None = None) -> dict | None:
        if not date_str:
            date_str = date.today().isoformat()
        try:
            return await self._get(f"/daily-journal/{date_str}")
        except httpx.HTTPStatusError:
            return None

    # ─── Setups / Playbook ───────────────────────────────────

    async def list_setups(self) -> list[dict]:
        try:
            result = await self._get("/setups/")
            if isinstance(result, list):
                return result
            if isinstance(result, dict):
                return result.get("items", [])
            return []
        except (httpx.HTTPStatusError, Exception):
            return []

    # ─── Coach / Alerts ──────────────────────────────────────

    async def get_coach_review(self) -> dict | None:
        try:
            return await self._get("/coach/latest")
        except httpx.HTTPStatusError:
            return None