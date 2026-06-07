"""Manual QA pass — Market Regime Intelligence (Tests 1–5).

Exercises API + service layers the same way the UI does:
Market Context, Command Center, Recommendations, Playbook Intelligence, fresh user.
"""

from __future__ import annotations

import json
import math
from datetime import date, datetime, timedelta

import pytest

from app.models.user import User


# ─── helpers ─────────────────────────────────────────────────────


def _assert_no_nan(obj, path: str = "root") -> None:
    """Fail on NaN/Inf anywhere in a JSON-serializable tree."""
    if obj is None:
        return
    if isinstance(obj, float):
        assert not math.isnan(obj), f"NaN at {path}"
        assert not math.isinf(obj), f"Inf at {path}"
    elif isinstance(obj, dict):
        for k, v in obj.items():
            _assert_no_nan(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            _assert_no_nan(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        assert obj.lower() not in ("nan", "infinity", "-infinity"), f"bad string at {path}: {obj}"


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _save_snapshot(client, token, d: date, **fields):
    payload = {"date": d.isoformat(), **fields}
    resp = client.post("/api/v1/market/snapshot", json=payload, headers=_headers(token))
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _create_trade(client, token, symbol, entry, exit, setup="Breakout", stop=95, entry_time=None):
    payload = {
        "symbol": symbol,
        "entry_price": str(entry),
        "exit_price": str(exit),
        "quantity": "10",
        "direction": "LONG",
        "setup": setup,
        "stop_price": str(stop),
        "entry_time": (entry_time or datetime.utcnow()).isoformat(),
    }
    resp = client.post("/api/v1/trades/", json=payload, headers=_headers(token))
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _create_setup(client, token, name="Breakout"):
    resp = client.post(
        "/api/v1/setups/",
        json={"name": name, "description": f"{name} setup for QA"},
        headers=_headers(token),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _seed_bull_wins(client, token, count: int, base: date, prefix: str = "BULL"):
    """Winning trades on uptrend days → TRENDING_BULL."""
    for i in range(count):
        d = base + timedelta(days=i)
        _save_snapshot(
            client, token, d,
            nifty_trend="uptrend", nifty_change_pct="1.4", india_vix="14",
        )
        _create_trade(
            client, token, f"{prefix}{i}", 100, 130, setup="Breakout",
            entry_time=datetime.combine(d, datetime.min.time()).replace(hour=10),
        )


def _seed_range_losses(client, token, count: int, base: date, prefix: str = "RNG"):
    """Losing trades on range days → RANGE_BOUND."""
    for i in range(count):
        d = base + timedelta(days=i)
        _save_snapshot(
            client, token, d,
            nifty_trend="sideways", nifty_change_pct="0.2", india_vix="15",
        )
        _create_trade(
            client, token, f"{prefix}{i}", 100, 90, setup="Breakout",
            entry_time=datetime.combine(d, datetime.min.time()).replace(hour=10),
        )


def _fresh_user_token(client) -> str:
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "fresh-qa@test.com", "full_name": "Fresh QA", "password": "pass12345"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


# ─── Test 1: Market Context page (API surface) ─────────────────


def test_qa1_market_context_full_dashboard(client, auth_user_token):
    """Current regime card, performance table, and matrix all load with data."""
    base = date(2025, 7, 1)
    _seed_bull_wins(client, auth_user_token, 8, base)
    _seed_range_losses(client, auth_user_token, 4, base + timedelta(days=30))

    # Latest snapshot must be after all seeded dates
    latest = base + timedelta(days=50)
    _save_snapshot(
        client, auth_user_token, latest,
        nifty_trend="uptrend", nifty_change_pct="1.5", india_vix="13",
    )

    dash = client.get("/api/v1/market-regime", headers=_headers(auth_user_token))
    assert dash.status_code == 200
    body = dash.json()
    _assert_no_nan(body)

    assert body["current"] is not None
    assert body["current"]["regime"] == "TRENDING_BULL"
    assert body["current"]["best_setup"] == "Breakout"
    assert len(body["performance"]["regimes"]) >= 1
    assert body["performance"]["matched_trades"] >= 8
    assert len(body["matrix"]["rows"]) >= 1

    current = client.get("/api/v1/market-regime/current", headers=_headers(auth_user_token))
    assert current.status_code == 200
    _assert_no_nan(current.json())

    perf = client.get("/api/v1/market-regime/performance", headers=_headers(auth_user_token))
    assert perf.status_code == 200
    _assert_no_nan(perf.json())
    assert perf.json()["regimes"]

    matrix = client.get("/api/v1/market-regime/matrix", headers=_headers(auth_user_token))
    assert matrix.status_code == 200
    _assert_no_nan(matrix.json())
    assert matrix.json()["rows"]


def test_qa1_market_context_empty_sections(client, auth_user_token):
    """Performance/matrix return empty arrays — no crash, no NaN (empty-state path)."""
    perf = client.get("/api/v1/market-regime/performance", headers=_headers(auth_user_token))
    assert perf.status_code == 200
    body = perf.json()
    _assert_no_nan(body)
    assert body["matched_trades"] == 0
    assert body["regimes"] == []

    matrix = client.get("/api/v1/market-regime/matrix", headers=_headers(auth_user_token))
    assert matrix.status_code == 200
    _assert_no_nan(matrix.json())
    assert matrix.json()["rows"] == []

    current = client.get("/api/v1/market-regime/current", headers=_headers(auth_user_token))
    assert current.status_code == 404


# ─── Test 2: Command Center ──────────────────────────────────────


def test_qa2_command_center_regime_priority_favorable(client, auth_user_token):
    """Current regime priority + best setup when regime is favorable."""
    base = date(2025, 8, 1)
    _seed_bull_wins(client, auth_user_token, 10, base)
    latest = base + timedelta(days=15)
    _save_snapshot(
        client, auth_user_token, latest,
        nifty_trend="uptrend", nifty_change_pct="1.6", india_vix="14",
    )

    resp = client.get("/api/v1/edge-command-center", headers=_headers(auth_user_token))
    assert resp.status_code == 200
    data = resp.json()
    _assert_no_nan(data)

    assert data["market_regime"] is not None
    assert data["market_regime"]["regime"] == "TRENDING_BULL"
    assert data["market_regime"]["best_setup"] == "Breakout"
    assert data["market_regime"]["best_setup_expectancy_r"] is not None
    assert data["market_regime"]["best_setup_expectancy_r"] > 0

    regime_prio = next((p for p in data["priorities"] if p["id"] == "market-regime-current"), None)
    assert regime_prio is not None, "Expected market-regime-current priority"
    assert "Current regime" in regime_prio["title"]
    assert regime_prio["severity"] == "info"
    assert regime_prio["related_setup"] == "Breakout"
    assert any("Best:" in e or "Breakout" in e for e in regime_prio["evidence"])


def test_qa2_command_center_unfavorable_warning(client, auth_user_token):
    """Unfavorable current regime → warning severity on regime priority."""
    base = date(2025, 9, 1)
    _seed_range_losses(client, auth_user_token, 12, base)
    latest = base + timedelta(days=20)
    _save_snapshot(
        client, auth_user_token, latest,
        nifty_trend="sideways", nifty_change_pct="0.3", india_vix="15",
    )

    resp = client.get("/api/v1/edge-command-center", headers=_headers(auth_user_token))
    assert resp.status_code == 200
    data = resp.json()
    _assert_no_nan(data)

    assert data["market_regime"]["regime"] == "RANGE_BOUND"
    assert data["market_regime"]["status"] == "UNFAVORABLE"

    regime_prio = next(p for p in data["priorities"] if p["id"] == "market-regime-current")
    assert regime_prio["severity"] == "warning"
    assert "unfavorable" in regime_prio["summary"].lower()


# ─── Test 3: Recommendations (20+ sample) ────────────────────────


# ─── Test 4: Playbook Intelligence ───────────────────────────────


def test_qa4_playbook_regime_performance(client, auth_user_token):
    """regime_performance with correct best/worst regime for a setup."""
    _create_setup(client, auth_user_token, "Breakout")
    base = date(2025, 11, 1)
    _seed_bull_wins(client, auth_user_token, 6, base)
    _seed_range_losses(client, auth_user_token, 6, base + timedelta(days=20))

    resp = client.get(
        "/api/v1/playbook/intelligence/Breakout",
        headers=_headers(auth_user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    _assert_no_nan(body)

    rp = body["regime_performance"]
    assert rp is not None
    assert rp["best_regime"] == "TRENDING_BULL"
    assert rp["worst_regime"] == "RANGE_BOUND"
    assert len(rp["by_regime"]) >= 2

    bull = next(c for c in rp["by_regime"] if c["regime"] == "TRENDING_BULL")
    rng = next(c for c in rp["by_regime"] if c["regime"] == "RANGE_BOUND")
    assert bull["expectancy_r"] > 0
    assert rng["expectancy_r"] < 0
    assert bull["sample_size"] == 6
    assert rng["sample_size"] == 6


def test_qa4_playbook_no_trades_regime_null(client, auth_user_token):
    """Setup exists but no trades → regime_performance is null, no crash."""
    _create_setup(client, auth_user_token, "Pullback")
    resp = client.get(
        "/api/v1/playbook/intelligence/Pullback",
        headers=_headers(auth_user_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    _assert_no_nan(body)
    assert body["regime_performance"] is None


# ─── Test 5: Fresh user ──────────────────────────────────────────


def test_qa5_fresh_user_graceful_empty(client):
    """No snapshots, no trades — all endpoints safe, no NaN."""
    token = _fresh_user_token(client)

    perf = client.get("/api/v1/market-regime/performance", headers=_headers(token))
    assert perf.status_code == 200
    _assert_no_nan(perf.json())
    assert perf.json()["matched_trades"] == 0

    matrix = client.get("/api/v1/market-regime/matrix", headers=_headers(token))
    assert matrix.status_code == 200
    _assert_no_nan(matrix.json())
    assert matrix.json()["rows"] == []

    current = client.get("/api/v1/market-regime/current", headers=_headers(token))
    assert current.status_code == 404

    dash = client.get("/api/v1/market-regime", headers=_headers(token))
    assert dash.status_code == 200
    _assert_no_nan(dash.json())
    assert dash.json()["current"] is None

    edge = client.get("/api/v1/edge-command-center", headers=_headers(token))
    assert edge.status_code == 200
    _assert_no_nan(edge.json())
    assert edge.json()["market_regime"] is None
    assert not any(p["id"] == "market-regime-current" for p in edge.json()["priorities"])
