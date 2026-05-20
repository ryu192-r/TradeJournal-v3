"""
Market Context Router — daily market environment snapshots and trade-vs-market correlation.

GET  /api/v1/market/snapshot/{date}            — get a specific day's market snapshot
GET  /api/v1/market/snapshots                  — list recent snapshots
POST /api/v1/market/snapshot                   — create/update a snapshot manually
POST /api/v1/market/fetch                      — save a Tapetide-format snapshot
POST /api/v1/market/seed                       — bulk-seed historical snapshots
GET  /api/v1/market/performance-correlation    — correlate user trades vs market environment
GET  /api/v1/market/regime-summary             — summarize NIFTY regimes and win rates
GET  /api/v1/market/my-symbols                 — distinct symbols from user's trades
POST /api/v1/market/live-quotes                — upsert live quotes from Tapetide
GET  /api/v1/market/live-quotes                — get cached live quotes
"""

from datetime import datetime, date, timedelta
from typing import Optional
from decimal import Decimal
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.db.database import get_db
from app.models.trade import Trade
from app.models.market_snapshot import MarketSnapshot
from app.models.live_quote import LiveQuote
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/market", tags=["market-context"])


# ─────────────────────── helpers ───────────────────────

NIFTY_TRENDS = ("uptrend", "downtrend", "sideways")
NIFTY_REGIMES = ("bullish", "bearish", "neutral", "volatile")


def _classify_trend(snap: MarketSnapshot) -> tuple[str, str]:
    nifty = float(snap.nifty_close or 0)
    high = float(snap.nifty_high or 0)
    low = float(snap.nifty_low or 0)
    change = float(snap.nifty_change_pct or 0)
    vix = float(snap.india_vix or 0)

    if nifty == 0:
        return "unknown", "unknown"

    if change > 1.0:
        trend = "uptrend"
    elif change < -1.0:
        trend = "downtrend"
    else:
        trend = "sideways"

    if vix > 25:
        regime = "volatile"
    elif change > 0.5:
        regime = "bullish"
    elif change < -0.5:
        regime = "bearish"
    else:
        regime = "neutral"

    return trend, regime


# ─────────────────────── CRUD ───────────────────────

@router.get("/snapshots")
def list_snapshots(
    days: int = Query(30, description="Number of recent days"),
    db: Session = Depends(get_db),
):
    """List recent market snapshots."""
    snaps = db.query(MarketSnapshot).order_by(
        desc(MarketSnapshot.date)
    ).limit(days).all()

    return {
        "snapshots": [
            {
                "date": str(s.date),
                "nifty_close": str(s.nifty_close) if s.nifty_close else None,
                "nifty_change_pct": str(s.nifty_change_pct) if s.nifty_change_pct else None,
                "nifty_trend": s.nifty_trend,
                "nifty_regime": s.nifty_regime,
                "india_vix": str(s.india_vix) if s.india_vix else None,
                "atr_pct": str(s.atr_pct) if s.atr_pct else None,
                "advance_count": s.advance_count,
                "decline_count": s.decline_count,
                "advance_decline_ratio": str(s.advance_decline_ratio) if s.advance_decline_ratio else None,
                "sector_strength": s.sector_strength,
                "fii_flow_cr": str(s.fii_flow_cr) if s.fii_flow_cr else None,
                "dii_flow_cr": str(s.dii_flow_cr) if s.dii_flow_cr else None,
                "is_earnings_season": s.is_earnings_season,
                "macro_events": s.macro_events,
            }
            for s in snaps
        ],
        "total": len(snaps),
    }


@router.get("/snapshot/{snapshot_date}")
def get_snapshot(
    snapshot_date: str,
    db: Session = Depends(get_db),
):
    """Get a specific day's market snapshot."""
    try:
        d = date.fromisoformat(snapshot_date)
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD.")

    snap = db.query(MarketSnapshot).filter(MarketSnapshot.date == d).first()
    if not snap:
        raise HTTPException(404, f"No market snapshot for {snapshot_date}")

    return {
        "date": str(snap.date),
        "nifty_close": str(snap.nifty_close) if snap.nifty_close else None,
        "nifty_change_pct": str(snap.nifty_change_pct) if snap.nifty_change_pct else None,
        "nifty_high": str(snap.nifty_high) if snap.nifty_high else None,
        "nifty_low": str(snap.nifty_low) if snap.nifty_low else None,
        "nifty_open": str(snap.nifty_open) if snap.nifty_open else None,
        "nifty_trend": snap.nifty_trend,
        "nifty_regime": snap.nifty_regime,
        "india_vix": str(snap.india_vix) if snap.india_vix else None,
        "atr_14": str(snap.atr_14) if snap.atr_14 else None,
        "atr_pct": str(snap.atr_pct) if snap.atr_pct else None,
        "advance_count": snap.advance_count,
        "decline_count": snap.decline_count,
        "advance_decline_ratio": str(snap.advance_decline_ratio) if snap.advance_decline_ratio else None,
        "sector_strength": snap.sector_strength,
        "fii_flow_cr": str(snap.fii_flow_cr) if snap.fii_flow_cr else None,
        "dii_flow_cr": str(snap.dii_flow_cr) if snap.dii_flow_cr else None,
        "is_earnings_season": snap.is_earnings_season,
        "macro_events": snap.macro_events,
        "notes": snap.notes,
    }


@router.post("/snapshot")
def create_or_update_snapshot(
    payload: dict,
    db: Session = Depends(get_db),
):
    """Create or update a market snapshot. If date exists, updates fields."""
    snap_date_str = payload.get("date")
    if not snap_date_str:
        raise HTTPException(400, "date is required (YYYY-MM-DD)")

    try:
        d = date.fromisoformat(snap_date_str)
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD.")

    snap = db.query(MarketSnapshot).filter(MarketSnapshot.date == d).first()

    if not snap:
        snap = MarketSnapshot(date=d)
        db.add(snap)

    for field in (
        "nifty_close", "nifty_change_pct", "nifty_high", "nifty_low", "nifty_open",
        "nifty_trend", "nifty_regime", "india_vix", "atr_14", "atr_pct",
        "advance_count", "decline_count", "advance_decline_ratio",
        "sector_strength", "fii_flow_cr", "dii_flow_cr",
        "is_earnings_season", "macro_events", "notes",
    ):
        if field in payload:
            val = payload[field]
            if isinstance(val, (int, float)) and field not in (
                "advance_count", "decline_count", "sector_strength", "macro_events",
                "is_earnings_season", "nifty_trend", "nifty_regime", "notes",
            ):
                val = Decimal(str(val))
            setattr(snap, field, val)

    if not snap.nifty_trend or not snap.nifty_regime:
        trend, regime = _classify_trend(snap)
        if not snap.nifty_trend:
            snap.nifty_trend = trend
        if not snap.nifty_regime:
            snap.nifty_regime = regime

    db.commit()
    db.refresh(snap)

    return {
        "id": snap.id,
        "date": str(snap.date),
        "nifty_trend": snap.nifty_trend,
        "nifty_regime": snap.nifty_regime,
        "message": "Snapshot saved",
    }


# ─────────────────────── fetch from Tapetide ───────────────────────

def _parse_tapetide_payload(payload: dict) -> dict:
    """Convert a Tapetide-format payload into flat snap_data for create_or_update_snapshot."""
    snap_data: dict = {}

    pulse = payload.get("pulse") or {}
    if pulse:
        if pulse.get("nifty_close") is not None:
            snap_data["nifty_close"] = pulse["nifty_close"]
        if pulse.get("nifty_change_pct") is not None:
            snap_data["nifty_change_pct"] = pulse["nifty_change_pct"]
        if pulse.get("vix") is not None:
            snap_data["india_vix"] = pulse["vix"]

    heatmap = payload.get("heatmap") or []
    if isinstance(heatmap, list):
        sector_strength = {}
        for item in heatmap:
            if isinstance(item, dict):
                name = item.get("sector")
                if name:
                    sector_strength[name] = {
                        "change_pct": item.get("change_pct") or item.get("pPerchange1d"),
                        "last_price": item.get("Ltp") or item.get("last_price"),
                        "market_cap": item.get("Mcap"),
                        "pe": item.get("Pe"),
                    }
        if sector_strength:
            snap_data["sector_strength"] = sector_strength

        nifty_items = [h for h in heatmap if isinstance(h, dict) and h.get("sector") == "NIFTY 50"]
        if nifty_items:
            ni = nifty_items[0]
            if not snap_data.get("nifty_close") and ni.get("Ltp"):
                snap_data["nifty_close"] = ni["Ltp"]
            if not snap_data.get("nifty_change_pct") and ni.get("pPerchange1d") is not None:
                snap_data["nifty_change_pct"] = ni["pPerchange1d"]

    fii_dii = payload.get("fii_dii") or {}
    if fii_dii:
        if fii_dii.get("fii_net") is not None:
            snap_data["fii_flow_cr"] = fii_dii["fii_net"]
        if fii_dii.get("dii_net") is not None:
            snap_data["dii_flow_cr"] = fii_dii["dii_net"]

    sectors = payload.get("sectors") or {}
    if isinstance(sectors, dict) and sectors:
        existing_ss = snap_data.get("sector_strength", {})
        if not isinstance(existing_ss, dict):
            existing_ss = {}
        for name, info in sectors.items():
            if name not in existing_ss:
                existing_ss[name] = {}
            existing_ss[name]["aum_share"] = info.get("aum_share")
            existing_ss[name]["fortnight_change"] = info.get("fortnight_change")
            existing_ss[name]["one_year_flow"] = info.get("one_year_flow")
        snap_data["sector_strength"] = existing_ss

    if payload.get("advances") is not None:
        snap_data["advance_count"] = payload["advances"]
    if payload.get("declines") is not None:
        snap_data["decline_count"] = payload["declines"]
    if snap_data.get("advance_count") and snap_data.get("decline_count"):
        dec = snap_data["decline_count"] or 1
        snap_data["advance_decline_ratio"] = round(snap_data["advance_count"] / dec, 4)

    return snap_data


@router.post("/fetch")
def fetch_market_data(
    payload: dict,
    db: Session = Depends(get_db),
):
    """Save a market snapshot from Tapetide API data.

    Frontend calls Tapetide tools (market_pulse, market_heatmap,
    market_valuations, get_fii_dii_detail, get_fpi_sectors) and sends
    the combined payload here. Fields are mapped to MarketSnapshot columns.

    Expected payload shape (all fields optional — missing ones stay null):
    {
      "date": "2025-01-15",
      "pulse": { "nifty_close": 23500, "nifty_change_pct": 0.85, "vix": 14.2, ... },
      "heatmap": [ { "sector": "IT", "change_pct": 1.5, ... }, ... ],
      "fii_dii": { "fii_net": -1200.5, "dii_net": 1500.3, ... },
      "sectors": { "IT": { "aum_share": 18.5, "fortnight_change": 0.3 }, ... },
      "valuations": { "pe": 22.5, "pb": 4.1, "dividend_yield": 1.2 },
      "advances": 1200,
      "declines": 800
    }
    """
    snap_date_str = payload.get("date")
    if not snap_date_str:
        raise HTTPException(400, "date is required (YYYY-MM-DD)")

    try:
        d = date.fromisoformat(snap_date_str)
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD.")

    snap_data = _parse_tapetide_payload(payload)
    snap_data["date"] = str(d)

    saved = create_or_update_snapshot(snap_data, db)
    return saved


@router.post("/seed")
def seed_snapshots(
    payload: dict,
    db: Session = Depends(get_db),
):
    """Bulk-seed market snapshots from Tapetide historical data.

    Accepts a list of snapshot dicts (same format as /fetch payload).
    Skips dates that already have snapshots.
    """
    snapshots = payload.get("snapshots") or []
    if not isinstance(snapshots, list):
        raise HTTPException(400, "snapshots must be a list")

    added = 0
    skipped = 0
    errors = []

    for i, snap_payload in enumerate(snapshots):
        try:
            d_str = snap_payload.get("date")
            if not d_str:
                errors.append(f"row {i}: missing date")
                continue
            d = date.fromisoformat(d_str)
            existing = db.query(MarketSnapshot).filter(MarketSnapshot.date == d).first()
            if existing:
                skipped += 1
                continue

            parsed = _parse_tapetide_payload(snap_payload)
            parsed["date"] = d_str
            create_or_update_snapshot(parsed, db)
            added += 1
        except Exception as e:
            errors.append(f"row {i}: {str(e)}")

    return {
        "added": added,
        "skipped": skipped,
        "errors": errors,
        "total": len(snapshots),
    }


# ─────────────────────── correlation endpoint ───────────────────────

@router.get("/performance-correlation")
def performance_correlation(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Correlate user's trade performance against market environment.

    Returns win rate, avg PnL, and expectancy broken down by:
    - NIFTY trend (uptrend/downtrend/sideways)
    - NIFTY regime (bullish/bearish/neutral/volatile)
    - India VIX buckets (low/medium/high)
    - Advance/decline ratio
    - Earnings season
    """
    start = date.fromisoformat(from_date) if from_date else None
    end_dt = date.fromisoformat(to_date) if to_date else None

    snap_q = db.query(MarketSnapshot)
    if start:
        snap_q = snap_q.filter(MarketSnapshot.date >= start)
    if end_dt:
        snap_q = snap_q.filter(MarketSnapshot.date <= end_dt)
    snapshots = snap_q.all()

    if not snapshots:
        return {
            "by_trend": {},
            "by_regime": {},
            "by_vix_bucket": {},
            "by_breadth": {},
            "by_earnings_season": {},
            "insights": [],
            "total_matched_trades": 0,
        }

    snap_map: dict[date, MarketSnapshot] = {s.date: s for s in snapshots}

    trade_q = db.query(Trade).filter(Trade.status != "deleted", Trade.exit_price.isnot(None))
    if start:
        trade_q = trade_q.filter(Trade.entry_time >= datetime.combine(start, datetime.min.time()))
    if end_dt:
        trade_q = trade_q.filter(Trade.entry_time <= datetime.combine(end_dt, datetime.max.time()))
    closed_trades = trade_q.all()

    matched_trades: list[tuple[Trade, MarketSnapshot]] = []
    for t in closed_trades:
        trade_date = t.entry_time.date() if t.entry_time else None
        if trade_date and trade_date in snap_map:
            matched_trades.append((t, snap_map[trade_date]))

    def _aggregate(trades_snaps: list[tuple[Trade, MarketSnapshot]], key_fn) -> dict:
        buckets: dict[str, list[float]] = defaultdict(list)
        for t, s in trades_snaps:
            key = key_fn(t, s)
            buckets[key].append(float(t.pnl or 0))

        result = {}
        for key, pnls in sorted(buckets.items()):
            wins = [p for p in pnls if p > 0]
            result[key] = {
                "trade_count": len(pnls),
                "win_rate": round(len(wins) / len(pnls) * 100, 1) if pnls else None,
                "avg_pnl": round(sum(pnls) / len(pnls), 2) if pnls else None,
                "total_pnl": round(sum(pnls), 2),
                "expectancy": round(sum(pnls) / len(pnls), 2) if pnls else None,
            }
        return result

    by_trend = _aggregate(matched_trades, lambda t, s: s.nifty_trend or "unknown")
    by_regime = _aggregate(matched_trades, lambda t, s: s.nifty_regime or "unknown")

    def _vix_bucket(t, s):
        vix = float(s.india_vix or 0)
        if vix == 0:
            return "unknown"
        elif vix < 15:
            return "low (<15)"
        elif vix < 22:
            return "medium (15-22)"
        else:
            return "high (>22)"

    by_vix_bucket = _aggregate(matched_trades, _vix_bucket)

    def _breadth_bucket(t, s):
        adv = s.advance_count or 0
        dec = s.decline_count or 0
        if adv == 0 and dec == 0:
            return "unknown"
        ratio = adv / dec if dec > 0 else float("inf")
        if ratio >= 2:
            return "strong breadth (>2:1)"
        elif ratio >= 1:
            return "neutral (1-2:1)"
        else:
            return "weak breadth (<1:1)"

    by_breadth = _aggregate(matched_trades, _breadth_bucket)
    by_earnings = _aggregate(matched_trades, lambda t, s: s.is_earnings_season or "unknown")

    insights = []
    if by_trend:
        best_trend = max(by_trend.items(), key=lambda x: x[1].get("avg_pnl") or -999999)
        worst_trend = min(by_trend.items(), key=lambda x: x[1].get("avg_pnl") or 999999)
        if best_trend[0] != worst_trend[0]:
            insights.append({
                "type": "insight",
                "message": f"Best NIFTY trend: {best_trend[0]} (avg ₹{best_trend[1].get('avg_pnl')}, {best_trend[1].get('win_rate')}% win). Worst: {worst_trend[0]} (avg ₹{worst_trend[1].get('avg_pnl')}).",
            })

    if by_regime:
        best_regime = max(by_regime.items(), key=lambda x: x[1].get("avg_pnl") or -999999)
        insights.append({
            "type": "insight",
            "message": f"You trade best in {best_regime[0]} markets (avg ₹{best_regime[0]} PnL, {best_regime[1].get('win_rate')}% win rate).",
        })

    if by_vix_bucket:
        high_vix = by_vix_bucket.get("high (>22)", {})
        low_vix = by_vix_bucket.get("low (<15)", {})
        if high_vix.get("trade_count") and low_vix.get("trade_count"):
            if (high_vix.get("win_rate") or 0) < (low_vix.get("win_rate") or 0):
                insights.append({
                    "type": "warning",
                    "message": f"Win rate drops to {high_vix.get('win_rate')}% in high VIX (>22) vs {low_vix.get('win_rate')}% in low VIX. Consider reducing size when VIX is elevated.",
                })

    return {
        "by_trend": by_trend,
        "by_regime": by_regime,
        "by_vix_bucket": by_vix_bucket,
        "by_breadth": by_breadth,
        "by_earnings_season": by_earnings,
        "insights": insights,
        "total_matched_trades": len(matched_trades),
    }


# ─────────────────────── regime summary ───────────────────────

@router.get("/regime-summary")
def regime_summary(
    days: int = Query(90, description="Lookback days"),
    db: Session = Depends(get_db),
):
    """Summarize NIFTY regime distribution and current state."""
    cutoff = date.today() - timedelta(days=days)
    snaps = db.query(MarketSnapshot).filter(MarketSnapshot.date >= cutoff).order_by(desc(MarketSnapshot.date)).all()

    if not snaps:
        return {
            "current": None,
            "regime_distribution": {},
            "trend_distribution": {},
            "avg_vix": None,
            "total_days": 0,
        }

    latest = snaps[0]
    regime_counts: dict[str, int] = defaultdict(int)
    trend_counts: dict[str, int] = defaultdict(int)
    vix_values = []

    for s in snaps:
        if s.nifty_regime:
            regime_counts[s.nifty_regime] += 1
        if s.nifty_trend:
            trend_counts[s.nifty_trend] += 1
        if s.india_vix:
            vix_values.append(float(s.india_vix))

    return {
        "current": {
            "date": str(latest.date),
            "nifty_close": str(latest.nifty_close) if latest.nifty_close else None,
            "nifty_change_pct": str(latest.nifty_change_pct) if latest.nifty_change_pct else None,
            "nifty_trend": latest.nifty_trend,
            "nifty_regime": latest.nifty_regime,
            "india_vix": str(latest.india_vix) if latest.india_vix else None,
            "advance_count": latest.advance_count,
            "decline_count": latest.decline_count,
            "sector_strength": latest.sector_strength,
            "is_earnings_season": latest.is_earnings_season,
            "fii_flow_cr": str(latest.fii_flow_cr) if latest.fii_flow_cr else None,
            "dii_flow_cr": str(latest.dii_flow_cr) if latest.dii_flow_cr else None,
        },
        "regime_distribution": dict(regime_counts),
        "trend_distribution": dict(trend_counts),
        "avg_vix": round(sum(vix_values) / len(vix_values), 2) if vix_values else None,
        "total_days": len(snaps),
    }


# ─────────────────────── live quotes for user's stocks ───────────────────────

@router.get("/my-symbols")
def my_symbols(
    db: Session = Depends(get_db),
):
    """Get distinct symbols from user's trades (open + closed, not deleted)."""
    symbols = (
        db.query(Trade.symbol)
        .filter(Trade.status != "deleted")
        .distinct()
        .order_by(Trade.symbol)
        .all()
    )
    return {"symbols": [s[0] for s in symbols]}


@router.post("/live-quotes")
def upsert_live_quotes(
    payload: dict,
    db: Session = Depends(get_db),
):
    """Upsert live stock quotes from Tapetide batch quote data.

    Expected payload: { "quotes": [ { "symbol": "RELIANCE", "ltp": 1335.9, ... }, ... ] }
    """
    quotes = payload.get("quotes") or []
    if not isinstance(quotes, list):
        raise HTTPException(400, "quotes must be a list")

    upserted = 0
    errors = []

    for i, q in enumerate(quotes):
        try:
            sym = q.get("symbol")
            if not sym:
                errors.append(f"row {i}: missing symbol")
                continue

            existing = db.query(LiveQuote).filter(LiveQuote.symbol == sym).first()
            if not existing:
                existing = LiveQuote(symbol=sym)
                db.add(existing)

            for field in (
                "company_name", "ltp", "change", "change_pct", "volume",
                "high_52w", "low_52w", "pe", "market_cap_cr", "sector",
            ):
                if field in q and q[field] is not None:
                    val = q[field]
                    if field not in ("company_name", "sector") and isinstance(val, (int, float)):
                        val = Decimal(str(val))
                    setattr(existing, field, val)

            upserted += 1
        except Exception as e:
            errors.append(f"row {i} ({q.get('symbol', '?')}): {str(e)}")

    db.commit()
    return {"upserted": upserted, "errors": errors, "total": len(quotes)}


@router.post("/sync-quotes")
def sync_live_quotes(
    db: Session = Depends(get_db),
):
    """Fetch fresh live quotes for all tracked symbols and cache them.

    Current implementation returns symbols ready for external sync.
    In production this should call an external market data provider
    (Tapetide MCP) to fetch real-time quotes and upsert via POST /live-quotes.
    """
    symbols = (
        db.query(Trade.symbol)
        .filter(Trade.status != "deleted")
        .distinct()
        .order_by(Trade.symbol)
        .all()
    )
    symbol_list = [s[0] for s in symbols]
    logger.info("sync_quotes_requested", symbols=symbol_list, count=len(symbol_list))
    return {
        "symbols": symbol_list,
        "count": len(symbol_list),
        "message": "Pass these symbols to your market data provider, then POST results to /market/live-quotes",
    }


@router.get("/live-quotes")
def get_live_quotes(
    db: Session = Depends(get_db),
):
    """Get cached live quotes for all tracked stocks."""
    quotes = db.query(LiveQuote).order_by(LiveQuote.symbol).all()

    return {
        "quotes": [
            {
                "symbol": q.symbol,
                "company_name": q.company_name,
                "ltp": str(q.ltp) if q.ltp else None,
                "change": str(q.change) if q.change else None,
                "change_pct": str(q.change_pct) if q.change_pct else None,
                "volume": str(q.volume) if q.volume else None,
                "high_52w": str(q.high_52w) if q.high_52w else None,
                "low_52w": str(q.low_52w) if q.low_52w else None,
                "pe": str(q.pe) if q.pe else None,
                "market_cap_cr": str(q.market_cap_cr) if q.market_cap_cr else None,
                "sector": q.sector,
                "updated_at": q.updated_at.isoformat() if q.updated_at else None,
            }
            for q in quotes
        ],
        "total": len(quotes),
    }