"""Market data provider integration service."""

from decimal import Decimal
from typing import Any

from app.utils.logging import get_logger

logger = get_logger(__name__)


def _to_decimal(value):
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except Exception:
        return None


def _map_nsetools_quote(raw: dict) -> dict[str, Any]:
    return {
        "symbol": raw.get("symbol"),
        "company_name": raw.get("companyName"),
        "ltp": _to_decimal(raw.get("lastPrice")),
        "change": _to_decimal(raw.get("change")),
        "change_pct": _to_decimal(raw.get("pChange")),
        "volume": _to_decimal(raw.get("totalTradedVolume")),
    }


def _map_yfinance_quote(symbol: str, company_name: str | None, ltp, change, change_pct, volume) -> dict[str, Any]:
    return {
        "symbol": symbol,
        "company_name": company_name,
        "ltp": _to_decimal(ltp),
        "change": _to_decimal(change),
        "change_pct": _to_decimal(change_pct),
        "volume": _to_decimal(volume),
    }


def _to_nse_ticker(symbol: str) -> str:
    return symbol if symbol.endswith(".NS") else f"{symbol}.NS"


def _fetch_nsetools_quotes(symbols: list[str]) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    try:
        from nsetools import Nse
    except ImportError:
        return {}, {sym: "nsetools not installed" for sym in symbols}

    nse = Nse()
    quotes: dict[str, dict[str, Any]] = {}
    errors: dict[str, str] = {}

    for sym in symbols:
        try:
            raw = nse.get_quote(sym)
            if not raw or raw.get("lastPrice") is None:
                errors[sym] = "no price data returned"
                continue
            raw["symbol"] = sym
            mapped = _map_nsetools_quote(raw)
            if mapped.get("ltp") is None:
                errors[sym] = "invalid quote payload"
                continue
            quotes[sym] = mapped
        except Exception as exc:
            errors[sym] = str(exc)

    logger.info(
        "nsetools_fetch_complete",
        requested=len(symbols),
        received=len(quotes),
        errors=len(errors),
    )
    return quotes, errors


def _fetch_yfinance_quotes(symbols: list[str]) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    try:
        import yfinance as yf
    except ImportError:
        return {}, {sym: "yfinance not installed" for sym in symbols}

    quotes: dict[str, dict[str, Any]] = {}
    errors: dict[str, str] = {}

    for sym in symbols:
        try:
            ticker = yf.Ticker(_to_nse_ticker(sym))
            history = ticker.history(period="5d", interval="1d", auto_adjust=False)
            fast_info = getattr(ticker, "fast_info", {}) or {}
            try:
                info = ticker.info or {}
            except Exception:
                info = {}

            ltp = fast_info.get("lastPrice")
            close_series = history["Close"].dropna() if not history.empty and "Close" in history else None
            if ltp is None and close_series is not None and not close_series.empty:
                ltp = close_series.iloc[-1]
            if ltp is None:
                errors[sym] = "no price data returned"
                continue

            previous_close = fast_info.get("previousClose")
            if previous_close is None and close_series is not None and len(close_series) >= 2:
                previous_close = close_series.iloc[-2]

            change = None
            change_pct = None
            if previous_close not in (None, 0):
                change = float(ltp) - float(previous_close)
                change_pct = (change / float(previous_close)) * 100

            volume = fast_info.get("lastVolume")
            if volume is None and not history.empty and "Volume" in history:
                volume_series = history["Volume"].dropna()
                if not volume_series.empty:
                    volume = volume_series.iloc[-1]

            company_name = info.get("shortName") or info.get("longName")
            quotes[sym] = _map_yfinance_quote(sym, company_name, ltp, change, change_pct, volume)
        except Exception as exc:
            errors[sym] = str(exc)

    logger.info(
        "yfinance_fetch_complete",
        requested=len(symbols),
        received=len(quotes),
        errors=len(errors),
    )
    return quotes, errors


def fetch_live_quotes(symbols: list[str]) -> tuple[list[dict], list[str]]:
    if not symbols:
        return [], []

    logger.info(
        "fetching_live_quotes",
        providers=["nsetools", "yfinance"],
        symbol_count=len(symbols),
        symbols=symbols,
    )

    nsetools_quotes, nsetools_errors = _fetch_nsetools_quotes(symbols)
    missing_symbols = [sym for sym in symbols if sym not in nsetools_quotes]
    yfinance_quotes: dict[str, dict[str, Any]] = {}
    yfinance_errors: dict[str, str] = {}

    if missing_symbols:
        logger.info(
            "fetching_live_quotes_fallback",
            provider="yfinance",
            symbol_count=len(missing_symbols),
            symbols=missing_symbols,
        )
        yfinance_quotes, yfinance_errors = _fetch_yfinance_quotes(missing_symbols)

    quotes_by_symbol = {**nsetools_quotes, **yfinance_quotes}
    quotes = [quotes_by_symbol[sym] for sym in symbols if sym in quotes_by_symbol]
    errors: list[str] = []

    for sym in symbols:
        if sym in quotes_by_symbol:
            continue
        provider_errors = []
        if sym in nsetools_errors:
            provider_errors.append(f"nsetools: {nsetools_errors[sym]}")
        if sym in yfinance_errors:
            provider_errors.append(f"yfinance: {yfinance_errors[sym]}")
        if not provider_errors:
            provider_errors.append("quote fetch failed")
        errors.append(f"{sym}: {'; '.join(provider_errors)}")

    if not quotes and errors:
        logger.warning(
            "all_quote_providers_failed",
            requested=len(symbols),
            errors=errors[:5],
        )

    return quotes, errors
