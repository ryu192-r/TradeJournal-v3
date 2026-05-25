"""Market data provider integration service.

Primary: yfinance (batch download, reliable, 15-min delayed NSE data)
Fallback: nsetools (per-symbol scrape, unreliable but real-time when it works)
"""

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


def _to_nse_ticker(symbol: str) -> str:
    return symbol if symbol.endswith(".NS") else f"{symbol}.NS"


def _from_nse_ticker(ticker: str) -> str:
    return ticker.replace(".NS", "") if ticker.endswith(".NS") else ticker


def _fetch_yfinance_batch(symbols: list[str]) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    """Fetch quotes for multiple symbols in ONE yfinance download call.

    Uses yf.download() for batch price data (fast) + per-symbol .info for
    company_name, sector, PE, market_cap (slower but only if needed).
    """
    try:
        import yfinance as yf
    except ImportError:
        return {}, {sym: "yfinance not installed" for sym in symbols}

    quotes: dict[str, dict[str, Any]] = {}
    errors: dict[str, str] = {}

    if not symbols:
        return quotes, errors

    nse_tickers = [_to_nse_ticker(sym) for sym in symbols]
    ticker_str = " ".join(nse_tickers)

    try:
        hist = yf.download(
            ticker_str,
            period="5d",
            interval="1d",
            auto_adjust=False,
            threads=False,
            progress=False,
        )
    except Exception as exc:
        logger.warning("yfinance_batch_download_failed", error=str(exc))
        return {}, {sym: f"batch download failed: {exc}" for sym in symbols}

    if hist.empty:
        return {}, {sym: "no price data returned" for sym in symbols}

    close_col = "Close" if len(nse_tickers) == 1 else None
    volume_col = "Volume" if len(nse_tickers) == 1 else None
    high_col = "High" if len(nse_tickers) == 1 else None
    low_col = "Low" if len(nse_tickers) == 1 else None

    for sym, nse_ticker in zip(symbols, nse_tickers):
        try:
            if len(nse_tickers) > 1:
                close_col = (nse_ticker, "Close")
                volume_col = (nse_ticker, "Volume")
                high_col = (nse_ticker, "High")
                low_col = (nse_ticker, "Low")

            close_series = hist[close_col].dropna() if close_col in hist else None
            volume_series = hist[volume_col].dropna() if volume_col in hist else None
            high_series = hist[high_col].dropna() if high_col in hist else None
            low_series = hist[low_col].dropna() if low_col in hist else None

            ltp = None
            if close_series is not None and not close_series.empty:
                ltp = float(close_series.iloc[-1])

            previous_close = None
            if close_series is not None and len(close_series) >= 2:
                previous_close = float(close_series.iloc[-2])

            volume = None
            if volume_series is not None and not volume_series.empty:
                volume = float(volume_series.iloc[-1])

            high_52w = None
            if high_series is not None and not high_series.empty:
                high_52w = float(high_series.max())

            low_52w = None
            if low_series is not None and not low_series.empty:
                low_52w = float(low_series.min())

            if ltp is None:
                errors[sym] = "no price data returned"
                continue

            change = None
            change_pct = None
            if previous_close is not None and previous_close != 0:
                change = ltp - previous_close
                change_pct = (change / previous_close) * 100

            quotes[sym] = {
                "symbol": sym,
                "company_name": None,
                "ltp": _to_decimal(ltp),
                "change": _to_decimal(change),
                "change_pct": _to_decimal(change_pct),
                "volume": _to_decimal(volume),
                "high_52w": _to_decimal(high_52w),
                "low_52w": _to_decimal(low_52w),
            }
        except Exception as exc:
            errors[sym] = str(exc)

    if len(symbols) > 20:
        info_symbols = symbols[:20]
        logger.info("yfinance_info_limited", requested=len(symbols), info_fetched=20)
    else:
        info_symbols = symbols

    for sym in info_symbols:
        if sym in errors:
            continue
        try:
            ticker = yf.Ticker(_to_nse_ticker(sym))
            try:
                info = ticker.info or {}
            except Exception:
                info = {}

            company_name = info.get("shortName") or info.get("longName")
            sector = info.get("sector")
            pe = info.get("trailingPE")
            market_cap = info.get("marketCap")

            if sym in quotes:
                if company_name:
                    quotes[sym]["company_name"] = company_name
                if sector:
                    quotes[sym]["sector"] = sector
                if pe is not None:
                    quotes[sym]["pe"] = _to_decimal(pe)
                if market_cap is not None:
                    cr = float(market_cap) / 1e7
                    quotes[sym]["market_cap_cr"] = _to_decimal(round(cr, 2))
        except Exception:
            pass

    logger.info(
        "yfinance_batch_complete",
        requested=len(symbols),
        received=len(quotes),
        errors=len(errors),
    )
    return quotes, errors


def _fetch_nsetools_quotes(symbols: list[str]) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    """nsetools fetch — per-symbol, real-time but unreliable.

    Only used as enrichment when explicitly needed. NSE frequently blocks
    scrapers so this should not be the primary provider.
    """
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
            quotes[sym] = {
                "symbol": sym,
                "company_name": raw.get("companyName"),
                "ltp": _to_decimal(raw.get("lastPrice")),
                "change": _to_decimal(raw.get("change")),
                "change_pct": _to_decimal(raw.get("pChange")),
                "volume": _to_decimal(raw.get("totalTradedVolume")),
                "high_52w": _to_decimal(raw.get("weekHigh52")),
                "low_52w": _to_decimal(raw.get("weekLow52")),
            }
        except Exception as exc:
            errors[sym] = str(exc)

    logger.info(
        "nsetools_fetch_complete",
        requested=len(symbols),
        received=len(quotes),
        errors=len(errors),
    )
    return quotes, errors


def fetch_live_quotes(symbols: list[str]) -> tuple[list[dict], list[str]]:
    """Fetch live quotes — yfinance primary, nsetools fallback.

    yfinance: batch download (fast, reliable, ~15 min delayed for NSE)
    nsetools: per-symbol scrape (real-time but NSE blocks frequently)

    Falls back to nsetools only for symbols yfinance couldn't fetch.
    """
    if not symbols:
        return [], []

    logger.info(
        "fetching_live_quotes",
        primary="yfinance",
        fallback="nsetools",
        symbol_count=len(symbols),
    )

    yf_quotes, yf_errors = _fetch_yfinance_batch(symbols)

    missing_symbols = [sym for sym in symbols if sym not in yf_quotes]

    ns_quotes: dict[str, dict[str, Any]] = {}
    ns_errors: dict[str, str] = {}

    if missing_symbols:
        logger.info(
            "fetching_nsetools_fallback",
            symbol_count=len(missing_symbols),
            symbols=missing_symbols,
        )
        ns_quotes, ns_errors = _fetch_nsetools_quotes(missing_symbols)

    quotes_by_symbol = {**yf_quotes, **ns_quotes}
    quotes = [quotes_by_symbol[sym] for sym in symbols if sym in quotes_by_symbol]
    errors: list[str] = []

    for sym in symbols:
        if sym in quotes_by_symbol:
            continue
        provider_errors = []
        if sym in yf_errors:
            provider_errors.append(f"yfinance: {yf_errors[sym]}")
        if sym in ns_errors:
            provider_errors.append(f"nsetools: {ns_errors[sym]}")
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