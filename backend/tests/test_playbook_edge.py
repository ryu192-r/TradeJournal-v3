"""Playbook Edge Intelligence tests — R-based setup expectancy engine."""

from datetime import datetime, timedelta

from app.services.setup_edge_service import (
    _compute_confidence,
    _compute_status,
    _expectancy_from_r_vals,
    _profit_factor_r,
    calculate_setup_edge,
    compute_playbook_score,
    get_top_setup_edge,
    get_weakest_setup_edge,
)
from app.models.user import User
from app.schemas.playbook_edge import SetupEdgeConfidence, SetupEdgeMetrics, SetupEdgeStatus


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


def test_requires_auth(client):
    assert client.get("/api/v1/playbook-edge").status_code == 401
    assert client.get("/api/v1/playbook-edge/top").status_code == 401
    assert client.get("/api/v1/playbook-edge/weakest").status_code == 401


def test_user_isolation(client, auth_user_token):
    _create_trade(client, auth_user_token, "EDGEU1", 100, 120)
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "edgeuser2@test.com", "full_name": "Edge U2", "password": "pass12345"},
    )
    token2 = resp.json()["access_token"]
    data = client.get("/api/v1/playbook-edge", headers={"Authorization": f"Bearer {token2}"}).json()
    assert data["setups"] == []


def test_expectancy_formula():
    r_vals = [2.0, 1.0, -1.0, -0.5]
    win_rate, avg_w, avg_l, avg_r, exp, wins, losses, be = _expectancy_from_r_vals(r_vals)
    assert wins == 2
    assert losses == 2
    assert be == 0
    assert win_rate == 50.0
    assert avg_w == 1.5
    assert avg_l == -0.75
    assert avg_r == 0.38
    assert exp == round(0.5 * 1.5 - 0.5 * 0.75, 2)


def test_profit_factor_r():
    r_vals = [2.0, 1.0, -1.0, -0.5]
    pf = _profit_factor_r(r_vals)
    assert pf == round(3.0 / 1.5, 2)


def test_confidence_sample_thresholds():
    assert _compute_confidence(10, 0.5) == SetupEdgeConfidence.LOW
    assert _compute_confidence(25, 0.5) == SetupEdgeConfidence.MEDIUM
    assert _compute_confidence(55, 0.5) == SetupEdgeConfidence.HIGH


def test_confidence_downgrade_on_recent_negative_expectancy():
    assert _compute_confidence(55, -0.2) == SetupEdgeConfidence.MEDIUM
    assert _compute_confidence(25, -0.1) == SetupEdgeConfidence.LOW


def test_negative_expectancy_playbook_score_capped():
    """Consistently losing setup must not score high from consistency/win-rate alone."""
    metrics = SetupEdgeMetrics(
        setup_name="Loser",
        sample_size=25,
        win_rate=40.0,
        expectancy_r=-0.15,
        avg_r=-0.15,
        recent_30d_r=-0.12,
    )
    r_vals = [-0.2] * 25
    score = compute_playbook_score(metrics, r_vals)
    assert score.score <= 45


def test_status_focus_pause_watch():
    assert _compute_status(0.5, 30, SetupEdgeConfidence.HIGH) == SetupEdgeStatus.FOCUS
    assert _compute_status(0.5, 30, SetupEdgeConfidence.LOW) == SetupEdgeStatus.WATCH
    assert _compute_status(-0.1, 25, SetupEdgeConfidence.MEDIUM) == SetupEdgeStatus.PAUSE
    assert _compute_status(-0.1, 10, SetupEdgeConfidence.LOW) == SetupEdgeStatus.WATCH


def test_top_and_weakest_setup(client, auth_user_token):
    base = datetime.utcnow()
    for i in range(8):
        _create_trade(
            client, auth_user_token, f"WIN{i}", 100, 130, setup="Winner",
            entry_time=base - timedelta(days=i),
        )
    for i in range(8):
        _create_trade(
            client, auth_user_token, f"LOSE{i}", 100, 90, setup="Loser",
            entry_time=base - timedelta(days=i + 10),
        )

    top = client.get("/api/v1/playbook-edge/top", headers={"Authorization": f"Bearer {auth_user_token}"})
    assert top.status_code == 200
    assert top.json()["setup_name"] == "Winner"
    assert top.json()["expectancy_r"] > 0

    weakest = client.get("/api/v1/playbook-edge/weakest", headers={"Authorization": f"Bearer {auth_user_token}"})
    assert weakest.status_code == 200
    assert weakest.json()["setup_name"] == "Loser"
    assert weakest.json()["expectancy_r"] < 0


def test_list_includes_focus_and_pause(client, auth_user_token, db_session):
    base = datetime.utcnow()
    for i in range(25):
        _create_trade(
            client, auth_user_token, f"F{i}", 100, 130, setup="FocusSetup",
            entry_time=base - timedelta(days=i),
        )
    for i in range(25):
        _create_trade(
            client, auth_user_token, f"P{i}", 100, 90, setup="PauseSetup",
            entry_time=base - timedelta(days=i + 30),
        )

    resp = client.get("/api/v1/playbook-edge", headers={"Authorization": f"Bearer {auth_user_token}"})
    assert resp.status_code == 200
    data = resp.json()
    names = {s["setup_name"] for s in data["setups"]}
    assert "FocusSetup" in names
    assert "PauseSetup" in names
    assert "FocusSetup" in data["focus_setups"]
    assert "PauseSetup" in data["pause_setups"]


def test_single_setup_detail(client, auth_user_token):
    _create_trade(client, auth_user_token, "DET1", 100, 120, setup="Breakout")
    resp = client.get(
        "/api/v1/playbook-edge/Breakout",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["metrics"]["setup_name"] == "Breakout"
    assert body["metrics"]["sample_size"] == 1
    assert body["playbook_score"]["score"] >= 0
    assert isinstance(body["conditions"], list)


def test_service_user_scoped(db_session, client, auth_user_token):
    """User A trade data must not appear in User B edge calculations."""
    _create_trade(client, auth_user_token, "SVC1", 100, 120, setup="SvcSetup")
    user1 = db_session.query(User).filter_by(email="pytest@example.com").first()
    assert user1 is not None

    detail = calculate_setup_edge(db_session, "SvcSetup", user1.id)
    assert detail.metrics.sample_size == 1
    assert detail.metrics.expectancy_r is not None

    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "svciso@test.com", "full_name": "Iso", "password": "pass12345"},
    )
    assert resp.status_code == 201
    user2 = db_session.query(User).filter_by(email="svciso@test.com").first()
    assert user2 is not None
    assert user2.id != user1.id

    assert calculate_setup_edge(db_session, "SvcSetup", user2.id).metrics.sample_size == 0
    assert get_top_setup_edge(db_session, user2.id) is None
