"""Market data provider integration service.

Abstracts external quote fetching and normalizes provider responses into
a consistent format for the live_quotes upsert endpoint.

Current provider: Tapetide-compatible batch quote API.
"""

from typing import Any
from decimal import Decimal
import requests
from app.core.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)


def _map_tapetide_quote(raw: dict) -> dict[str, Any]:
    """Normalize a single Tapetide quote into LiveQuote-compatible fields.

    Tapetide fields:  symbol, price, change, change_pct, volume, high, low, open, prev_close, name
    LiveQuote fields: symbol, ltp, change, change_pct, volume, company_name
    """
    return {
        "symbol": raw.get("symbol"),
        "company_name": raw.get("name"),
        "ltp": _to_decimal(raw.get("price")),
        "change": _to_decimal(raw.get("change")),
        "change_pct": _to_decimal(raw.get("change_pct")),
        "volume": _to_decimal(raw.get("volume")),
    }


def _to_decimal(v):
    if v is None:
        return None
    try:
        return Decimal(str(v))
    except Exception:
        return None


def fetch_live_quotes(symbols: list[str]) -> tuple[list[dict], list[str]]:
    """Fetch fresh live quotes for the given symbols from the external provider.

    Returns: (quotes_list, error_messages)
    """
    if not symbols:
        return [], []

    url = settings.MARKET_DATA_API_URL or "https://api.tapetide.in/v1/quotes"
    api_key = settings.MARKET_DATA_API_KEY

    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    logger.info(
        "fetching_live_quotes",
        provider_url=url,
        symbol_count=len(symbols),
        symbols=symbols,
    )

    try:
        resp = requests.post(
            url,
            headers=headers,
            json={"symbols": symbols},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        if "data" in data:
            raw_quotes = data["data"]
        elif "quotes" in data:
            raw_quotes = data["quotes"]
        else:
            raw_quotes = data if isinstance(data, list) else []

        mapped = [_map_tapetide_quote(q) for q in raw_quotes]
        mapped = [q for q in mapped if q.get("symbol")]

        logger.info(
            "live_quotes_fetched",
            requested=len(symbols),
            received=len(mapped),
        )
        return mapped, []

    except requests.exceptions.Timeout:
        logger.error("live_quotes_fetch_timeout")
        return [], ["Provider timeout after 15s"]
    except requests.exceptions.RequestException as exc:
        logger.error("live_quotes_fetch_failed", error=str(exc))
        return [], [f"Provider request failed: {str(exc)}"]
    except Exception as exc:
        logger.error("live_quotes_fetch_error", error=str(exc))
        return [], [f"Unexpected error: {str(exc)}"]
