"""Market Regime Intelligence tests — classification, performance, status, matrix, isolation."""

from datetime import date, datetime, timedelta
from types import SimpleNamespace

from app.models.user import User
from app.schemas.market_regime import (
    MarketRegimeType,
    RegimeConfidence,
    RegimeStatus,
)
from app.services.market_regime_service import (
    calculate_regime_performance,
    calculate_setup_regime_matrix,
    classify_market_regime,
    confidence_from_sample,
    get_current_regime,
    get_regime_recommendations,
    status_from_expectancy,
)


def _snap(**kw):
    base = dict(
        nifty_close=22000, nifty_change_pct=0.0, india_vix=14.0,
        atr_pct=1.0, advance_decline_ratio=1.0, nifty_trend="sideways",
        nifty_regime="neutral",
    )
    base.update(kw)
    return SimpleNamespace(**base)


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
    resp = client.post("/api/v1/trades/", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _save_snapshot(client, token, d, **fields):
    payload = {"date": d.isoformat(), **fields}
    resp = client.post("/api/v1/market/snapshot", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


# ─── Phase 3: classification ────────────────────────────────────


def test_classify_trending_bull():
    assert classify_market_regime(_snap(nifty_trend="uptrend", nifty_change_pct=1.2)) == MarketRegimeType.TRENDING_BULL


def test_classify_trending_bear():
    assert classify_market_regime(_snap(nifty_trend="downtrend", nifty_change_pct=-1.3)) == MarketRegimeType.TRENDING_BEAR


def test_classify_range_bound():
    assert classify_market_regime(_snap(nifty_trend="sideways", nifty_change_pct=0.4, india_vix=15)) == MarketRegimeType.RANGE_BOUND


def test_classify_high_volatility():
    assert classify_market_regime(_snap(india_vix=30, nifty_change_pct=-2)) == MarketRegimeType.HIGH_VOLATILITY


def test_classify_low_volatility():
    assert classify_market_regime(_snap(india_vix=10, nifty_change_pct=0.1, nifty_trend="sideways")) == MarketRegimeType.LOW_VOLATILITY


def test_classify_breakout():
    assert classify_market_regime(_snap(nifty_change_pct=1.8, advance_decline_ratio=2.5, nifty_trend="uptrend", india_vix=16)) == MarketRegimeType.BREAKOUT


def test_classify_reversal():
    assert classify_market_regime(_snap(nifty_change_pct=-1.7, advance_decline_ratio=0.3, india_vix=18, nifty_trend="downtrend")) == MarketRegimeType.REVERSAL


def test_classify_unknown_on_no_data():
    assert classify_market_regime(_snap(nifty_close=0, nifty_change_pct=0, india_vix=0, nifty_trend="")) == MarketRegimeType.UNKNOWN
    assert classify_market_regime(None) == MarketRegimeType.UNKNOWN


# ─── Phase 6: confidence ────────────────────────────────────────


def test_confidence_thresholds():
    assert confidence_from_sample(5) == RegimeConfidence.LOW
    assert confidence_from_sample(19) == RegimeConfidence.LOW
    assert confidence_from_sample(20) == RegimeConfidence.MEDIUM
    assert confidence_from_sample(49) == RegimeConfidence.MEDIUM
    assert confidence_from_sample(50) == RegimeConfidence.HIGH


# ─── Phase 8: status ────────────────────────────────────────────


def test_status_rules():
    assert status_from_expectancy(0.5) == RegimeStatus.FAVORABLE
    assert status_from_expectancy(0.25) == RegimeStatus.NEUTRAL  # boundary, not > 0.25
    assert status_from_expectancy(0.1) == RegimeStatus.NEUTRAL
    assert status_from_expectancy(-0.1) == RegimeStatus.UNFAVORABLE
    assert status_from_expectancy(None) == RegimeStatus.NEUTRAL


# ─── auth ───────────────────────────────────────────────────────


def test_requires_auth(client):
    assert client.get("/api/v1/market-regime").status_code == 401
    assert client.get("/api/v1/market-regime/current").status_code == 401
    assert client.get("/api/v1/market-regime/performance").status_code == 401
    assert client.get("/api/v1/market-regime/matrix").status_code == 401


# ─── Phase 4/7: performance + current via service ──────────────


def test_regime_performance_and_current(client, auth_user_token, db_session):
    base = date(2025, 3, 3)  # Monday
    # Build bull-day snapshots + winning trades on those days
    for i in range(6):
        d = base + timedelta(days=i)
        _save_snapshot(client, auth_user_token, d, nifty_trend="uptrend", nifty_change_pct="1.4", india_vix="14")
        _create_trade(
            client, auth_user_token, f"BULL{i}", 100, 130, setup="Breakout",
            entry_time=datetime.combine(d, datetime.min.time()).replace(hour=10),
        )

    user = db_session.query(User).filter_by(email="pytest@example.com").first()
    perf = calculate_regime_performance(db_session, user.id)
    assert perf.matched_trades == 6
    bull = next(r for r in perf.regimes if r.regime == MarketRegimeType.TRENDING_BULL)
    assert bull.sample_size == 6
    assert bull.wins == 6
    assert bull.expectancy_r is not None and bull.expectancy_r > 0
    assert bull.status == RegimeStatus.FAVORABLE

    current = get_current_regime(db_session, user.id)
    assert current is not None
    assert current.regime == MarketRegimeType.TRENDING_BULL
    assert current.best_setup == "Breakout"


def test_current_regime_endpoint_404_when_empty(client, auth_user_token):
    resp = client.get("/api/v1/market-regime/current", headers={"Authorization": f"Bearer {auth_user_token}"})
    assert resp.status_code == 404


# ─── Phase 5: matrix ────────────────────────────────────────────


def test_setup_regime_matrix(client, auth_user_token, db_session):
    base = date(2025, 4, 1)
    # Breakout setup wins in bull days, loses in range days
    for i in range(4):
        d = base + timedelta(days=i)
        _save_snapshot(client, auth_user_token, d, nifty_trend="uptrend", nifty_change_pct="1.5", india_vix="13")
        _create_trade(client, auth_user_token, f"WB{i}", 100, 130, setup="Breakout",
                      entry_time=datetime.combine(d, datetime.min.time()).replace(hour=10))
    for i in range(4):
        d = base + timedelta(days=i + 10)
        _save_snapshot(client, auth_user_token, d, nifty_trend="sideways", nifty_change_pct="0.2", india_vix="15")
        _create_trade(client, auth_user_token, f"LR{i}", 100, 90, setup="Breakout",
                      entry_time=datetime.combine(d, datetime.min.time()).replace(hour=10))

    user = db_session.query(User).filter_by(email="pytest@example.com").first()
    matrix = calculate_setup_regime_matrix(db_session, user.id)
    row = next(r for r in matrix.rows if r.setup == "Breakout")
    cells = {c.regime: c for c in row.cells}
    assert MarketRegimeType.TRENDING_BULL in cells
    assert MarketRegimeType.RANGE_BOUND in cells
    assert cells[MarketRegimeType.TRENDING_BULL].expectancy_r > 0
    assert cells[MarketRegimeType.RANGE_BOUND].expectancy_r < 0
    assert row.best_regime == MarketRegimeType.TRENDING_BULL
    assert row.worst_regime == MarketRegimeType.RANGE_BOUND


# ─── recommendations (Phase 18) ─────────────────────────────────


def test_regime_recommendations_respect_min_sample(client, auth_user_token, db_session):
    base = date(2025, 5, 1)
    for i in range(5):  # below default min_sample of 20
        d = base + timedelta(days=i)
        _save_snapshot(client, auth_user_token, d, nifty_trend="uptrend", nifty_change_pct="1.4")
        _create_trade(client, auth_user_token, f"S{i}", 100, 130, setup="Breakout",
                      entry_time=datetime.combine(d, datetime.min.time()).replace(hour=10))
    user = db_session.query(User).filter_by(email="pytest@example.com").first()
    assert get_regime_recommendations(db_session, user.id) == []
    # With a low threshold, recommendations appear
    recs = get_regime_recommendations(db_session, user.id, min_sample=3)
    assert any(r["setup"] == "Breakout" and r["action"] == "focus" for r in recs)


# ─── user isolation ─────────────────────────────────────────────


def test_user_isolation(client, auth_user_token, db_session):
    base = date(2025, 6, 2)
    for i in range(3):
        d = base + timedelta(days=i)
        _save_snapshot(client, auth_user_token, d, nifty_trend="uptrend", nifty_change_pct="1.4")
        _create_trade(client, auth_user_token, f"ISO{i}", 100, 130, setup="Breakout",
                      entry_time=datetime.combine(d, datetime.min.time()).replace(hour=10))

    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "regiso@test.com", "full_name": "Iso", "password": "pass12345"},
    )
    token2 = resp.json()["access_token"]

    data = client.get("/api/v1/market-regime/performance", headers={"Authorization": f"Bearer {token2}"}).json()
    assert data["matched_trades"] == 0
    assert data["regimes"] == []

    matrix = client.get("/api/v1/market-regime/matrix", headers={"Authorization": f"Bearer {token2}"}).json()
    assert matrix["rows"] == []

    cur = client.get("/api/v1/market-regime/current", headers={"Authorization": f"Bearer {token2}"})
    assert cur.status_code == 404


def test_dashboard_endpoint(client, auth_user_token):
    d = date(2025, 2, 3)
    _save_snapshot(client, auth_user_token, d, nifty_trend="uptrend", nifty_change_pct="1.4")
    _create_trade(client, auth_user_token, "DSH1", 100, 130, setup="Breakout",
                  entry_time=datetime.combine(d, datetime.min.time()).replace(hour=10))
    resp = client.get("/api/v1/market-regime", headers={"Authorization": f"Bearer {auth_user_token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["current"]["regime"] == "TRENDING_BULL"
    assert "performance" in body and "matrix" in body
