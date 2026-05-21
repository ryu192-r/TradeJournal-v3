"""Market data provider integration service.

Fetches live NSE stock quotes using nsetools (official NSE India data).
Falls back gracefully if nsetools is unavailable.

Normalizes provider responses into a consistent format for the
live_quotes upsert endpoint.
"""

from typing import Any
from decimal import Decimal
from app.utils.logging import get_logger

logger = get_logger(__name__)


def _to_decimal(v):
    if v is None:
        return None
    try:
        return Decimal(str(v))
    except Exception:
        return None


def _map_nsetools_quote(raw: dict) -> dict[str, Any]:
    """Normalize an nsetools quote dict into LiveQuote-compatible fields.

    NSE fields (raw):     lastPrice, change, pChange, totalTradedVolume, companyName
    LiveQuote fields:     symbol, ltp, change, change_pct, volume, company_name
    """
    ltp = raw.get("lastPrice")
    change = raw.get("change")
    change_pct = raw.get("pChange")
    volume = raw.get("totalTradedVolume")
    company_name = raw.get("companyName")

    return {
        "symbol": raw.get("symbol"),
        "company_name": company_name,
        "ltp": _to_decimal(ltp),
        "change": _to_decimal(change),
        "change_pct": _to_decimal(change_pct),
        "volume": _to_decimal(volume),
    }


def _fetch_nsetools_quotes(symbols: list[str]) -> tuple[list[dict], list[str]]:
    """Fetch live quotes via nsetools (NSE India official)."""
    try:
        from nsetools import Nse
    except ImportError:
        return [], ["nsetools not installed"]

    nse = Nse()
    quotes = []
    errors = []

    for sym in symbols:
        try:
            raw = nse.get_quote(sym)
            if not raw or not raw.get("lastPrice"):
                errors.append(f"{sym}: no price data returned")
                continue
            raw["symbol"] = sym
            mapped = _map_nsetools_quote(raw)
            if mapped.get("symbol") and mapped.get("ltp") is not None:
                quotes.append(mapped)
        except Exception as e:
            errors.append(f"{sym}: {str(e)}")

    logger.info(
        "nsetools_fetch_complete",
        requested=len(symbols),
        received=len(quotes),
        errors=len(errors),
    )
    return quotes, errors


def fetch_live_quotes(symbols: list[str]) -> tuple[list[dict], list[str]]:
    """Fetch fresh live quotes for the given symbols.

    Primary provider: nsetools (NSE India).
    Returns: (quotes_list, error_messages)
    """
    if not symbols:
        return [], []

    logger.info(
        "fetching_live_quotes",
        provider="nsetools",
        symbol_count=len(symbols),
        symbols=symbols,
    )

    quotes, errors = _fetch_nsetools_quotes(symbols)

    if not quotes and errors:
        logger.warning(
            "all_nsetools_quotes_failed",
            requested=len(symbols),
            errors=errors[:5],
        )

    return quotes, errors
