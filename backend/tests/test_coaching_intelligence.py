"""Tests for Coaching Intelligence Phase 2 endpoints.

Tests use HTTPX TestClient with fresh SQLite DB per test function."""

from datetime import datetime, timedelta
from decimal import Decimal

import pytest

# Drift windows anchor at datetime.utcnow() in the service — use offsets from "now" in tests.


def _utc_offset_iso(*, days: int = 0, hours: int = 0) -> str:
    """UTC ISO entry_time offset from now (matches behavioral drift anchor)."""
    return (datetime.utcnow() - timedelta(days=days, hours=hours)).isoformat()


def _create_trade(client, token: str, symbol: str, entry_price: float, exit_price: float | None,
                  quantity: float = 10, pnl: float | None = None, setup: str = "Breakout",
                  entry_time: str | None = None, stop_price: float | None = None) -> dict:
    """Helper: create a trade via API."""
    now = datetime.utcnow().isoformat()
    payload = {
        "symbol": symbol,
        "entry_price": str(entry_price),
        "quantity": str(quantity),
        "direction": "LONG",
        "setup": setup,
        "entry_time": entry_time or now,
    }
    if exit_price is not None:
        payload["exit_price"] = str(exit_price)
    if pnl is not None:
        payload["pnl"] = str(pnl)
    if stop_price is not None:
        payload["stop_price"] = str(stop_price)
    resp = client.post(
        "/api/v1/trades/",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code in (200, 201), f"create trade failed: {resp.status_code} {resp.text}"
    return resp.json()


def _add_emotion(client, token: str, trade_id: int, emotion: str):
    """Helper: add emotion log."""
    resp = client.post(
        f"/api/v1/trades/{trade_id}/emotions",
        json={"trade_id": trade_id, "emotion": emotion},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code in (200, 201), f"add emotion failed: {resp.status_code} {resp.text}"


def _add_grade(client, token: str, trade_id: int, grade: str = "C"):
    """Helper: add execution grade."""
    resp = client.post(
        f"/api/v1/trades/{trade_id}/execution-grade",
        json={"overall_grade": grade, "entry_quality": grade, "exit_quality": grade,
              "sizing_quality": grade, "stop_quality": grade, "patience": grade, "rule_adherence": grade},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code in (200, 201), f"add grade failed: {resp.status_code} {resp.text}"


# ─── Test 1: endpoints require auth ────────────────────────────


def test_endpoints_require_auth(client):
    """All coaching-intelligence endpoints should 401 without auth token."""
    paths = [
        "/api/v1/coaching-intelligence/dashboard",
        "/api/v1/coaching-intelligence/weekly-plan",
        "/api/v1/coaching-intelligence/setup-scores",
        "/api/v1/coaching-intelligence/behavioral-drift",
        "/api/v1/coaching-intelligence/trade-review-prompts",
    ]
    for path in paths:
        resp = client.get(path)
        assert resp.status_code == 401, f"{path} should require auth, got {resp.status_code}"


# ─── Test 2: user isolation ────────────────────────────────────


def test_user_isolation(client, auth_user_token):
    """Second user cannot see first user's coaching data."""
    # Create data for user 1
    _create_trade(client, auth_user_token, "RELIANCE", 2500, 2600, pnl=1000, setup="Trend")

    # Register user 2
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "user2@test.com", "full_name": "User Two", "password": "pass12345"},
    )
    assert resp.status_code == 201
    token2 = resp.json()["access_token"]

    # User 2 should get empty/starting results
    resp = client.get(
        "/api/v1/coaching-intelligence/dashboard",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data.get("setup_scores", [])) == 0
    # Dashboard should not fail
    assert "generated_at" in data


# ─── Test 3: empty data returns starter plan ───────────────────


def test_empty_data_returns_starter_plan(client, auth_user_token):
    """No trades should still return a coaching plan, not a 400/500."""
    resp = client.get(
        "/api/v1/coaching-intelligence/weekly-plan",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "headline" in data
    assert "primary_focus" in data
    assert data["headline"] != ""
    assert "generated_at" in data

    # Dashboard should also work with empty data
    resp = client.get(
        "/api/v1/coaching-intelligence/dashboard",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200


# ─── Test 4: setup confidence labels work ──────────────────────


def test_setup_confidence_labels(client, auth_user_token):
    """Setup confidence labels should be valid."""
    # 10+ closed winners with stop → positive avg_r (scoring needs r_multiple)
    for i in range(12):
        _create_trade(
            client, auth_user_token, f"STOCK{i}", 100, 110, quantity=10,
            pnl=100, setup="Breakout", stop_price=95,
        )

    # Small-sample loser setup (n=1 caps score)
    _create_trade(
        client, auth_user_token, "LOSER", 100, 90, quantity=10,
        pnl=-100, setup="Reversal", stop_price=95,
    )

    resp = client.get(
        "/api/v1/coaching-intelligence/setup-scores",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    scores = resp.json()
    assert len(scores) == 2

    breakout = [s for s in scores if s["setup"] == "Breakout"][0]
    reversal = [s for s in scores if s["setup"] == "Reversal"][0]

    assert breakout["label"] in ("trusted", "priority", "developing")
    assert reversal["label"] in ("avoid", "watch")
    assert reversal["score"] <= 49  # Small sample caps


# ─── Test 4b: open partial exits excluded from setup scores ────


def test_open_partial_exits_excluded_from_setup_scores(client, auth_user_token):
    """Open trades with partial exits must not affect setup confidence metrics."""
    closed = _create_trade(
        client,
        auth_user_token,
        "CLOSED",
        100,
        110,
        quantity=10,
        pnl=100,
        setup="Breakout",
    )
    open_trade = _create_trade(
        client,
        auth_user_token,
        "OPENPART",
        100,
        None,
        quantity=10,
        setup="Breakout",
    )

    resp = client.post(
        f"/api/v1/trades/{open_trade['id']}/partial-exits",
        json={
            "qty": "5",
            "exit_price": "108",
            "exit_time": datetime.utcnow().isoformat(),
            "realized_pnl": "40",
        },
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 201), resp.text

    resp = client.get(
        "/api/v1/coaching-intelligence/setup-scores",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    scores = resp.json()
    breakout = [s for s in scores if s["setup"] == "Breakout"][0]

    assert breakout["sample_size"] == 1
    assert breakout["total_pnl"] == 100.0
    assert breakout["notes"] is None or "partial" not in (breakout["notes"] or "").lower()


# ─── Test 5: tiny sample cannot be priority ────────────────────


def test_tiny_sample_cannot_be_priority(client, auth_user_token):
    """Setups with 1-4 trades should not get 'priority' label."""
    for i in range(3):
        _create_trade(client, auth_user_token, f"TINY{i}", 100, 200, quantity=10,
                      pnl=1000, setup="Momentum")

    resp = client.get(
        "/api/v1/coaching-intelligence/setup-scores",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    scores = resp.json()
    momentum = [s for s in scores if s["setup"] == "Momentum"][0]
    assert momentum["label"] != "priority"
    assert momentum["score"] < 80


# ─── Test 6: negative expectancy cannot be trusted ─────────────


def test_negative_expectancy_cannot_be_trusted(client, auth_user_token):
    """Setups with negative avg R should not get 'trusted' or 'priority' label."""
    for i in range(10):
        _create_trade(client, auth_user_token, f"NEG{i}", 100, 85, quantity=10,
                      pnl=-150, setup="BadSetup")

    resp = client.get(
        "/api/v1/coaching-intelligence/setup-scores",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    scores = resp.json()
    bad = [s for s in scores if s["setup"] == "BadSetup"][0]
    assert bad["label"] in ("avoid", "watch")
    assert bad["score"] < 65


# ─── Test 7: behavioral drift detects overtrading ──────────────


def test_behavioral_drift_detects_overtrading(client, auth_user_token):
    """Many trades in recent UTC window vs sparse baseline — frequency drift fires."""
    lookback, baseline = 30, 90
    # Inside baseline window only: [now-120d, now-30d)
    for i in range(5):
        _create_trade(
            client, auth_user_token, f"OLD{i}", 100, 110, quantity=10,
            pnl=100, setup="Breakout", entry_time=_utc_offset_iso(days=100),
        )

    # Inside recent window: [now-30d, now]
    for i in range(20):
        _create_trade(
            client, auth_user_token, f"NEW{i}", 100, 105, quantity=10,
            pnl=50, setup="Breakout", entry_time=_utc_offset_iso(hours=i),
        )

    resp = client.get(
        f"/api/v1/coaching-intelligence/behavioral-drift"
        f"?lookback_days={lookback}&baseline_days={baseline}",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    signals = resp.json()
    freq_signals = [s for s in signals if s["id"] == "drift-frequency"]
    assert len(freq_signals) > 0, "Should detect frequency drift"


# ─── Test 8: behavioral drift avoids tiny sample noise ─────────


def test_behavioral_drift_avoids_tiny_sample_noise(client, auth_user_token):
    """Very few trades should not trigger drift warnings."""
    for sym, pnl in [("ONLY1", 100), ("ONLY2", -100), ("ONLY3", 50)]:
        _create_trade(
            client, auth_user_token, sym, 100, 110 if pnl > 0 else 90,
            quantity=10, pnl=pnl, setup="Breakout",
            entry_time=_utc_offset_iso(days=1),
        )

    resp = client.get(
        "/api/v1/coaching-intelligence/behavioral-drift?lookback_days=30&baseline_days=90",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    signals = resp.json()
    # Should have very few or no signals with tiny samples
    drift_metrics = {s["id"] for s in signals}
    # Frequency drift requires MIN_SAMPLE_FOR_DRIFT (5) trades
    assert "drift-frequency" not in drift_metrics, "Should not fire with tiny sample"


def test_behavioral_drift_execution_grades_use_baseline_window(client, auth_user_token):
    """Grade drift compares recent vs prior baseline window, not all-time grades."""
    lookback, baseline = 7, 30
    for i in range(5):
        t = _create_trade(
            client, auth_user_token, f"BASEG{i}", 100, 110, quantity=10,
            pnl=100, setup="Breakout", entry_time=_utc_offset_iso(days=20),
        )
        _add_grade(client, auth_user_token, t["id"], grade="A")

    for i in range(6):
        t = _create_trade(
            client, auth_user_token, f"RECENTG{i}", 100, 110, quantity=10,
            pnl=100, setup="Breakout", entry_time=_utc_offset_iso(days=1),
        )
        _add_grade(client, auth_user_token, t["id"], grade="D")

    resp = client.get(
        f"/api/v1/coaching-intelligence/behavioral-drift"
        f"?lookback_days={lookback}&baseline_days={baseline}",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    grade_signals = [s for s in resp.json() if s["id"] == "drift-execution-grades"]
    assert len(grade_signals) == 1
    assert grade_signals[0]["current_value"] == 2.0
    assert grade_signals[0]["baseline_value"] == 5.0


def test_behavioral_drift_execution_grades_vs_baseline_not_diluted(client, auth_user_token):
    """Large recent sample still compared to prior baseline window (not all-time pool)."""
    lookback, baseline = 7, 30
    for i in range(5):
        t = _create_trade(
            client, auth_user_token, f"STRONG{i}", 100, 110, quantity=10,
            pnl=100, setup="Breakout", entry_time=_utc_offset_iso(days=20),
        )
        _add_grade(client, auth_user_token, t["id"], grade="A")

    for i in range(30):
        t = _create_trade(
            client, auth_user_token, f"MED{i}", 100, 110, quantity=10,
            pnl=100, setup="Breakout", entry_time=_utc_offset_iso(days=1),
        )
        _add_grade(client, auth_user_token, t["id"], grade="C")

    resp = client.get(
        f"/api/v1/coaching-intelligence/behavioral-drift"
        f"?lookback_days={lookback}&baseline_days={baseline}",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    grade_signals = [s for s in resp.json() if s["id"] == "drift-execution-grades"]
    assert len(grade_signals) == 1, "C recent vs A baseline should exceed 1.0 grade drop"


def test_behavioral_drift_excludes_trades_outside_utc_windows(client, auth_user_token):
    """Trades older than lookback+baseline must not count as recent or baseline."""
    lookback, baseline = 30, 90
    # Outside total span (120d): only these exist
    for i in range(8):
        _create_trade(
            client, auth_user_token, f"ANCIENT{i}", 100, 110, quantity=10,
            pnl=100, setup="Breakout", entry_time=_utc_offset_iso(days=200),
        )

    resp = client.get(
        f"/api/v1/coaching-intelligence/behavioral-drift"
        f"?lookback_days={lookback}&baseline_days={baseline}",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == [], "No trades in recent window → no drift signals"


# ─── Test 9: weekly plan setup scores use historical window ─────


def test_weekly_plan_setup_scores_use_historical_window_not_current_week(client, auth_user_token):
    """Setup scores in weekly plan use 90d history even with no trades entered this week."""
    for i in range(12):
        _create_trade(
            client, auth_user_token, f"HIST{i}", 100, 110, quantity=10,
            pnl=100, setup="Breakout", stop_price=95,
            entry_time=_utc_offset_iso(days=60),
        )

    resp = client.get(
        "/api/v1/coaching-intelligence/weekly-plan",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["setup_scores"]) >= 1
    breakout = [s for s in data["setup_scores"] if s["setup"] == "Breakout"][0]
    assert breakout["sample_size"] == 12
    assert "No closed trades" in data["headline"]


# ─── Test 9b: weekly plan includes recommendations ─────────────


def test_weekly_plan_includes_recommendations(client, auth_user_token):
    """Weekly plan should reference recommendations from the engine."""
    # Add enough data for recommendations to fire
    _create_trade(client, auth_user_token, "STOCK1", 100, 110, quantity=10,
                  pnl=100, setup="Breakout")
    _create_trade(client, auth_user_token, "STOCK2", 100, 90, quantity=10,
                  pnl=-100, setup="Breakout")

    resp = client.get(
        "/api/v1/coaching-intelligence/weekly-plan",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "headline" in data
    assert "priorities" in data
    # Should not crash
    assert data is not None


# ─── Test 10: trade review prompts include largest loss ────────


def test_trade_review_prompts_include_largest_loss(client, auth_user_token):
    """The largest loss should get a review prompt."""
    _create_trade(client, auth_user_token, "WIN", 100, 110, quantity=10,
                  pnl=100, setup="Breakout")
    _create_trade(client, auth_user_token, "LOSER", 100, 50, quantity=10,
                  pnl=-500, setup="Breakout")
    _create_trade(client, auth_user_token, "SMALL", 100, 95, quantity=10,
                  pnl=-50, setup="Breakout")

    resp = client.get(
        "/api/v1/coaching-intelligence/trade-review-prompts",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    prompts = resp.json()
    # Should have at least one prompt (the loss)
    assert len(prompts) >= 1
    # The top prompt should reference the big loser
    top_prompt = prompts[0]
    assert "LOSER" in top_prompt["symbol"] or "loss" in top_prompt.get("related_patterns", [])


def test_trade_review_prompts_use_explicit_stop_check(client, auth_user_token):
    """None stop should count as missing stop, positive stop should not."""
    _create_trade(client, auth_user_token, "NONE", 100, 90, quantity=10, pnl=-100, setup="Breakout")
    _create_trade(client, auth_user_token, "OK", 100, 110, quantity=10, pnl=100, setup="Breakout", stop_price=95)

    resp = client.get(
        "/api/v1/coaching-intelligence/trade-review-prompts?limit=10",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    prompts = resp.json()
    no_stop_symbols = {p["symbol"] for p in prompts if "no-stop" in p.get("related_patterns", [])}
    assert "NONE" in no_stop_symbols
    assert "OK" not in no_stop_symbols


# ─── Test 11: deleted trades excluded ──────────────────────────


def test_deleted_trades_excluded(client, auth_user_token):
    """Deleted trades should not appear in prompts or scores."""
    trade = _create_trade(client, auth_user_token, "DELETE", 100, 50, quantity=10,
                          pnl=-500, setup="Breakout")
    # Delete the trade
    resp = client.delete(
        f"/api/v1/trades/{trade['id']}",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 204)

    # Should not show in prompts
    resp = client.get(
        "/api/v1/coaching-intelligence/trade-review-prompts",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    prompts = resp.json()
    for p in prompts:
        assert p["trade_id"] != trade["id"], "Deleted trades should be excluded"


# ─── Test 12: date/week filters respected ──────────────────────


def test_date_filters_respected(client, auth_user_token):
    """Setup scores with date filters should only return trades in range."""
    _create_trade(
        client, auth_user_token, "OLD", 100, 110, quantity=10,
        pnl=100, setup="OldSetup", entry_time=_utc_offset_iso(days=30),
    )
    _create_trade(client, auth_user_token, "NEW", 100, 110, quantity=10,
                  pnl=100, setup="NewSetup")

    # Filter to recent period only
    recent_start = _utc_offset_iso(days=7)
    resp = client.get(
        f"/api/v1/coaching-intelligence/setup-scores?period_start={recent_start}",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    scores = resp.json()
    setups = {s["setup"] for s in scores}
    assert "OldSetup" not in setups, "Old trades should be excluded by date filter"


# ─── Test 12b: invalid date filters return 422 ─────────────────


def test_invalid_date_filters_return_422(client, auth_user_token):
    """Invalid ISO dates should fail fast instead of widening scope."""
    paths = [
        "/api/v1/coaching-intelligence/weekly-plan?week_start=not-a-date",
        "/api/v1/coaching-intelligence/setup-scores?period_start=bad-date",
        "/api/v1/coaching-intelligence/setup-scores?period_end=2025-13-99T99:99:99",
    ]
    for path in paths:
        resp = client.get(path, headers={"Authorization": f"Bearer {auth_user_token}"})
        assert resp.status_code == 422, f"{path} should return 422"
        assert "Invalid" in resp.text


# ─── Test 13: no DB mutation from endpoints ────────────────────


def test_no_db_mutation_from_endpoints(client, auth_user_token, db_session):
    """All coaching-intelligence endpoints should be read-only."""
    from app.models.trade import Trade
    from app.models.coach_review import CoachReview

    before_count = db_session.query(Trade).count()
    before_reviews = db_session.query(CoachReview).count()

    # Hit all endpoints
    endpoints = [
        "/api/v1/coaching-intelligence/dashboard",
        "/api/v1/coaching-intelligence/weekly-plan",
        "/api/v1/coaching-intelligence/setup-scores",
        "/api/v1/coaching-intelligence/behavioral-drift",
        "/api/v1/coaching-intelligence/trade-review-prompts",
    ]
    for path in endpoints:
        resp = client.get(path, headers={"Authorization": f"Bearer {auth_user_token}"})
        assert resp.status_code == 200, f"{path} failed: {resp.text}"

    after_count = db_session.query(Trade).count()
    after_reviews = db_session.query(CoachReview).count()

    assert after_count == before_count, "Endpoints should not create/delete trades"
    assert after_reviews == before_reviews, "Endpoints should not create/delete reviews"
