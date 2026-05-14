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
    ) -> dict:
        url = f"{self.base_url}{path}"
        client = await self._ensure_client()
        logger.info("backend_request", method=method, url=url)
        resp = await client.request(method, url, params=params, json=json)
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, dict) else {"data": data}

    async def _get(self, path: str, params: dict | None = None) -> dict:
        return await self._request("GET", path, params=params)

    async def _post(self, path: str, json: dict) -> dict:
        return await self._request("POST", path, json=json)

    async def _put(self, path: str, json: dict) -> dict:
        return await self._request("PUT", path, json=json)

    # ─── Trades ──────────────────────────────────────────────

    async def create_trade(self, trade: dict[str, Any]) -> dict:
        """POST /trades/ — create a new trade (draft)."""
        payload = {k: v for k, v in trade.items() if v is not None}
        return await self._post("/trades/", json=payload)

    async def get_trade(self, trade_id: int) -> dict:
        """GET /trades/{id}."""
        return await self._get(f"/trades/{trade_id}")

    async def update_trade(self, trade_id: int, update: dict[str, Any]) -> dict:
        """PUT /trades/{id} — update fields or transition status."""
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
        """GET /trades/ — list with filters. Returns items list."""
        params: dict[str, Any] = {"limit": limit}
        if status:
            params["status"] = status
        if symbol:
            params["symbol"] = symbol
        result = await self._get("/trades/", params=params)
        items = result.get("items", []) if isinstance(result, dict) else result
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
        """Return draft + reviewed trades (not yet analytics / deleted)."""
        draft = await self.list_trades(limit=500, status="draft")
        reviewed = await self.list_trades(limit=500, status="reviewed")
        return draft + reviewed

    # ─── Analytics ───────────────────────────────────────────

    async def get_kpi(self) -> dict:
        """GET /analytics/kpi — top KPI cards."""
        try:
            return await self._get("/analytics/kpi")
        except httpx.HTTPStatusError:
            return {}

    async def get_daily_pnl(self, from_date: str | None = None) -> list[dict]:
        """GET /analytics/daily-pnl — daily PnL data points."""
        try:
            params = {"from_date": from_date} if from_date else None
            return await self._get("/analytics/daily-pnl", params=params)
        except httpx.HTTPStatusError:
            return []

    async def get_setup_performance(self) -> dict:
        """GET /analytics/setup-performance — per-setup breakdown."""
        try:
            return await self._get("/analytics/setup-performance")
        except httpx.HTTPStatusError:
            return {}

    async def get_streaks(self) -> dict:
        """GET /analytics/streaks — current and longest streaks."""
        try:
            return await self._get("/analytics/streaks")
        except httpx.HTTPStatusError:
            return {}

    async def get_equity_curve(self) -> dict:
        """GET /analytics/daily-pnl — used as equity-curve source."""
        try:
            return await self._get("/analytics/daily-pnl")
        except httpx.HTTPStatusError:
            return {}

    # ─── Journal ─────────────────────────────────────────────

    async def get_journal(self, date_str: str | None = None) -> dict | None:
        """GET /daily-journal/{date} — fetch a daily journal entry by date."""
        if not date_str:
            date_str = date.today().isoformat()
        try:
            return await self._get(f"/daily-journal/{date_str}")
        except httpx.HTTPStatusError:
            return None

    async def get_journal_today(self, today: str | None = None) -> dict | None:
        """Alias for get_journal — returns today's journal."""
        if today is None:
            today = date.today().isoformat()
        return await self.get_journal(today)

    # ─── Setups / Playbook ───────────────────────────────────

    async def list_setups(self) -> list[dict]:
        """GET /setups/ — list all setup types."""
        try:
            result = await self._get("/setups/")
            return result.get("items", [])
        except (httpx.HTTPStatusError, Exception):
            return []

    async def get_setups(self) -> dict:
        """GET /setups/ — raw dict response (items + metadata)."""
        try:
            return await self._get("/setups/")
        except (httpx.HTTPStatusError, Exception):
            return {"items": []}

    # ─── Coach / Alerts ──────────────────────────────────────

    async def get_coach_review(self) -> dict | None:
        """GET /coach/latest — most recent coach review."""
        try:
            return await self._get("/coach/latest")
        except httpx.HTTPStatusError:
            return None
