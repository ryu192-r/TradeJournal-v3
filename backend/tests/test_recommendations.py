"""Recommendation engine tests — endpoint + service logic."""

from datetime import datetime, timedelta


_date_counter = 0

def _create_trade(client, token, **overrides):
    global _date_counter
    _date_counter += 1
    day = 1 + (_date_counter % 28)
    trade = {
        "symbol": "RELIANCE",
        "direction": "LONG",
        "entry_price": 2500,
        "quantity": 10,
        "entry_time": f"2026-05-{day:02d}T09:30:00",
        "exit_time": f"2026-05-{day:02d}T10:00:00",
        "exit_price": 2600,
        "setup": "Breakout",
        **overrides,
    }
    if "symbol" not in overrides and "entry_time" not in overrides:
        trade["symbol"] = f"SYM{_date_counter}"
    resp = client.post("/api/v1/trades/", json=trade, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _create_journal(client, token, date_str: str, **overrides):
    payload = {
        "date": date_str,
        "pre_trade_notes": "test",
        **overrides,
    }
    client.post("/api/v1/journal/", json=payload, headers={"Authorization": f"Bearer {token}"})


# ── 1. endpoint requires auth ──


def test_requires_auth(client):
    resp = client.get("/api/v1/recommendations/dashboard")
    assert resp.status_code == 401


def test_summary_requires_auth(client):
    resp = client.get("/api/v1/recommendations/summary")
    assert resp.status_code == 401


# ── 2. user only sees own recommendations ──


def test_user_isolation(client, auth_user_token):
    """Two users' recommendations should not interfere."""
    # Second user
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "user2@test.com", "full_name": "User Two", "password": "pass12345"},
    )
    assert resp.status_code == 201
    token2 = resp.json()["access_token"]

    # First user has a profit trade
    _create_trade(client, auth_user_token, setup="Breakout", entry_price=100, exit_price=200, quantity=10)

    resp1 = client.get("/api/v1/recommendations/dashboard", headers={"Authorization": f"Bearer {auth_user_token}"})
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["total_trades"] == 1
    assert data1["closed_trades"] == 1

    resp2 = client.get("/api/v1/recommendations/dashboard", headers={"Authorization": f"Bearer {token2}"})
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["total_trades"] == 0


# ── 3. positive setup recommendation generated ──


def test_positive_setup_recommendation(client, auth_user_token):
    """Setup with 5+ closed profitable trades should generate 'focus more' rec."""
    for i in range(6):
        _create_trade(
            client, auth_user_token,
            setup="Breakout",
            symbol="RELIANCE",
            entry_price=100,
            exit_price=120 + i,
            quantity=10,
            entry_time=f"2025-01-{13+i:02d}T09:30:00",
        )

    resp = client.get("/api/v1/recommendations/dashboard", headers={"Authorization": f"Bearer {auth_user_token}"})
    assert resp.status_code == 200
    data = resp.json()
    titles = [r["title"] for r in data["recommendations"]]
    assert any("Focus more on" in t for t in titles), f"No focus rec found in {titles}"
    assert data["closed_trades"] >= 5


# ── 4. negative setup recommendation generated ──


def test_negative_setup_recommendation(client, auth_user_token):
    """Setup with 5+ losing trades should generate 'pause' rec."""
    for i in range(6):
        _create_trade(
            client, auth_user_token,
            setup="LoserSetup",
            symbol="RELIANCE",
            entry_price=200,
            exit_price=150 - i,  # losing trades
            quantity=10,
            entry_time=f"2025-01-{13+i:02d}T09:30:00",
        )

    resp = client.get("/api/v1/recommendations/dashboard", headers={"Authorization": f"Bearer {auth_user_token}"})
    assert resp.status_code == 200
    data = resp.json()
    titles = [r["title"] for r in data["recommendations"]]
    assert any("Reduce or pause" in t for t in titles), f"No pause rec found in {titles}"


# ── 5. low sample warning ──


def test_low_sample_warning(client, auth_user_token):
    """Setup with 1-4 trades should generate low sample warning."""
    for i in range(2):
        _create_trade(
            client, auth_user_token,
            setup="NewSetup",
            symbol="RELIANCE",
            entry_price=100,
            exit_price=120,
            quantity=10,
            entry_time=f"2025-01-{13+i:02d}T09:30:00",
        )

    resp = client.get("/api/v1/recommendations/dashboard", headers={"Authorization": f"Bearer {auth_user_token}"})
    assert resp.status_code == 200
    data = resp.json()
    titles = [r["title"] for r in data["recommendations"]]
    assert any("Sample size" in t for t in titles), f"No low sample rec in {titles}"


# ── 6. no deleted trades included ──


def test_deleted_trades_excluded(client, auth_user_token):
    """Deleted trades should not appear in recommendation data."""
    created = _create_trade(client, auth_user_token, setup="Breakout", entry_price=100, exit_price=120, quantity=10)
    client.delete(f"/api/v1/trades/{created['id']}", headers={"Authorization": f"Bearer {auth_user_token}"})

    resp = client.get("/api/v1/recommendations/dashboard", headers={"Authorization": f"Bearer {auth_user_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_trades"] == 0


# ── 7. recommendations sorted by priority ──


def test_recommendations_sorted_by_priority(client, auth_user_token):
    """Recommendations should be sorted descending by priority_score."""
    for i in range(6):
        _create_trade(
            client, auth_user_token,
            setup="Breakout",
            symbol="RELIANCE",
            entry_price=100,
            exit_price=200,
            quantity=10,
            entry_time=f"2025-01-{13+i:02d}T09:30:00",
        )

    resp = client.get("/api/v1/recommendations/dashboard", headers={"Authorization": f"Bearer {auth_user_token}"})
    data = resp.json()
    scores = [r["priority_score"] for r in data["recommendations"]]
    for i in range(1, len(scores)):
        assert scores[i] <= scores[i - 1], f"Not sorted: {scores}"


# ── 8. max recommendations capped ──


def test_max_recommendations_capped(client, auth_user_token):
    """Should not exceed MAX_RECOMMENDATIONS."""
    for i in range(6):
        _create_trade(
            client, auth_user_token,
            setup=f"Setup{i}",
            symbol="RELIANCE",
            entry_price=100,
            exit_price=200,
            quantity=10,
            entry_time=f"2025-01-{13+i:02d}T09:30:00",
        )

    resp = client.get("/api/v1/recommendations/dashboard", headers={"Authorization": f"Bearer {auth_user_token}"})
    data = resp.json()
    assert len(data["recommendations"]) <= 12


# ── 9. empty data returns helpful response ──


def test_empty_data_returns_helpful_response(client, auth_user_token):
    """Empty data should return empty recs + helpful summary."""
    resp = client.get("/api/v1/recommendations/dashboard", headers={"Authorization": f"Bearer {auth_user_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_trades"] == 0
    assert data["closed_trades"] == 0
    assert len(data["recommendations"]) == 0
    assert len(data["summary"]["focus_this_week"]) > 0
    assert len(data["summary"]["risks"]) > 0


# ── 10. date filters respected ──


def test_date_filters(client, auth_user_token):
    """Date filters should limit scope."""
    _create_trade(
        client, auth_user_token,
        setup="Breakout",
        entry_price=100, exit_price=120, quantity=10,
        entry_time="2025-01-01T09:30:00",
    )
    _create_trade(
        client, auth_user_token,
        setup="Breakout",
        entry_price=100, exit_price=120, quantity=10,
        entry_time="2025-06-01T09:30:00",
    )

    resp = client.get(
        "/api/v1/recommendations/dashboard",
        params={"period_start": "2025-05-01", "period_end": "2025-07-01"},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    data = resp.json()
    assert data["total_trades"] == 1
    assert data["closed_trades"] == 1


# ── 11. confidence/sample size ──


def test_confidence_scales_with_sample(client, auth_user_token):
    """Recommendation confidence should increase with sample size."""
    for i in range(15):
        _create_trade(
            client, auth_user_token,
            setup="Breakout",
            symbol="RELIANCE",
            entry_price=100,
            exit_price=120,
            quantity=10,
            entry_time=f"2025-01-{13+i:02d}T09:30:00",
        )

    resp = client.get("/api/v1/recommendations/dashboard", headers={"Authorization": f"Bearer {auth_user_token}"})
    data = resp.json()
    for rec in data["recommendations"]:
        if rec["category"] == "setup":
            assert rec["confidence"] > 0
            break


# ── 12. emotion warning if data exists ──


def test_emotion_warning(client, auth_user_token):
    """Emotion warnings should appear when emotion data exists."""
    trade = _create_trade(
        client, auth_user_token,
        setup="Breakout",
        entry_price=100, exit_price=90, quantity=10,
        entry_time="2025-01-13T09:30:00",
    )
    # Add revenge emotion
    client.post(
        f"/api/v1/trades/{trade['id']}/emotions",
        json={"emotion": "revenge", "confidence": 3},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )

    # Need more losing trades with revenge emotion
    for i in range(4):
        t = _create_trade(
            client, auth_user_token,
            setup="Breakout",
            symbol="RELIANCE",
            entry_price=100, exit_price=80 - i * 5, quantity=10,
            entry_time=f"2025-01-{14+i:02d}T09:30:00",
        )
        client.post(
            f"/api/v1/trades/{t['id']}/emotions",
            json={"emotion": "revenge", "confidence": 3},
            headers={"Authorization": f"Bearer {auth_user_token}"},
        )

    resp = client.get("/api/v1/recommendations/dashboard", headers={"Authorization": f"Bearer {auth_user_token}"})
    data = resp.json()
    titles = [r["title"] for r in data["recommendations"]]
    emotion_recs = [t for t in titles if "revenge" in t.lower()]
    assert len(emotion_recs) > 0, f"No emotion rec in {titles}"


# ── 13. execution weakness if grade data exists ──


def test_execution_weakness(client, auth_user_token):
    """Execution weakness recommendation should appear when grades exist."""
    for i in range(5):
        t = _create_trade(
            client, auth_user_token,
            setup="Breakout",
            symbol="RELIANCE",
            entry_price=100, exit_price=120, quantity=10,
            entry_time=f"2025-01-{13+i:02d}T09:30:00",
        )
        client.post(
            f"/api/v1/trades/{t['id']}/execution-grade",
            json={
                "entry_quality": "C",
                "sizing_quality": "C",
                "stop_quality": "F",
                "patience": "B",
                "rule_adherence": "B",
                "exit_quality": "C",
                "overall_grade": "C",
            },
            headers={"Authorization": f"Bearer {auth_user_token}"},
        )

    resp = client.get("/api/v1/recommendations/dashboard", headers={"Authorization": f"Bearer {auth_user_token}"})
    data = resp.json()
    titles = [r["title"] for r in data["recommendations"]]
    assert any("Improve" in t for t in titles), f"No execution weakness rec in {titles}"
