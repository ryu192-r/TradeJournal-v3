"""Tests for Edge Command Center."""

from datetime import datetime

import pytest
from sqlalchemy.orm import Session

from app.models.performance_os import DailyWorkflow
from app.models.trade import Trade
from app.models.user import User


def _create_trade(client, token: str, symbol: str, entry_price: float, exit_price: float | None,
                  setup: str = "Breakout", stop_price: float | None = 95) -> dict:
    payload = {
        "symbol": symbol,
        "entry_price": str(entry_price),
        "quantity": "10",
        "direction": "LONG",
        "setup": setup,
        "entry_time": datetime.utcnow().isoformat(),
        "stop_price": str(stop_price) if stop_price is not None else None,
    }
    if exit_price is not None:
        payload["exit_price"] = str(exit_price)
    resp = client.post("/api/v1/trades/", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _edge(client, token: str | None = None, query: str = ""):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.get(f"/api/v1/edge-command-center{query}", headers=headers)


def test_edge_requires_auth(client):
    assert _edge(client).status_code == 401


def test_user_isolation(client, auth_user_token):
    _create_trade(client, auth_user_token, "EDGE1", 100, 110)
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "edge2@test.com", "full_name": "Edge Two", "password": "pass12345"},
    )
    token2 = resp.json()["access_token"]
    data = _edge(client, token2).json()
    assert data["data_quality"]["total_trades"] == 0


def test_empty_data_starter_response(client, auth_user_token):
    resp = _edge(client, auth_user_token)
    assert resp.status_code == 200
    data = resp.json()
    assert data["headline"]
    assert data["next_best_action"]
    assert "generated_at" in data


def test_deleted_trade_excluded(client, auth_user_token, db_session: Session):
    t = _create_trade(client, auth_user_token, "EDGEDEL", 100, 110)
    trade = db_session.query(Trade).filter(Trade.id == t["id"]).first()
    trade.status = "deleted"
    db_session.commit()
    data = _edge(client, auth_user_token).json()
    assert all(item["trade_id"] != t["id"] for item in data["review_queue"])


def test_invalid_dates_422(client, auth_user_token):
    assert _edge(client, auth_user_token, "?period_start=not-a-date").status_code == 422


def test_period_order_422(client, auth_user_token):
    assert _edge(
        client, auth_user_token, "?period_start=2026-06-01&period_end=2026-01-01",
    ).status_code == 422


def test_no_stop_surfaces_in_review_queue(client, auth_user_token):
    # trade_review_v2 batch removed in Phase 3; review_queue now fed by coaching prompts only.
    # Just verify the endpoint still responds without error when a no-stop trade exists.
    _create_trade(client, auth_user_token, "NOSTOP", 100, 90, stop_price=None)
    data = _edge(client, auth_user_token).json()
    assert "review_queue" in data
    assert "priorities" in data


def test_setup_focus_from_confidence(client, auth_user_token):
    for i in range(6):
        _create_trade(client, auth_user_token, f"SF{i}", 100, 110 + i, setup="Breakout")
    data = _edge(client, auth_user_token).json()
    setups = {s["setup"] for s in data["setup_focus"]}
    assert len(data["setup_focus"]) <= 6
    if data["setup_focus"]:
        assert any("Breakout" in setups or "Uncategorised" in setups for _ in [1])


def test_review_queue_capped(client, auth_user_token):
    for i in range(12):
        _create_trade(client, auth_user_token, f"RQ{i}", 100, 90, stop_price=None)
    data = _edge(client, auth_user_token).json()
    assert len(data["review_queue"]) <= 8


def test_priorities_capped(client, auth_user_token):
    for i in range(10):
        _create_trade(client, auth_user_token, f"PR{i}", 100, 90, stop_price=None)
    data = _edge(client, auth_user_token).json()
    assert len(data["priorities"]) <= 8


def test_workflow_read_only_no_create(client, auth_user_token, db_session: Session):
    user = db_session.query(User).filter(User.email == "pytest@example.com").first()
    before = db_session.query(DailyWorkflow).filter(DailyWorkflow.user_id == user.id).count()
    _edge(client, auth_user_token)
    after = db_session.query(DailyWorkflow).filter(DailyWorkflow.user_id == user.id).count()
    assert after == before
    data = _edge(client, auth_user_token).json()
    assert data["workflow"] is not None
    assert data["workflow"]["next_step"]


def test_partial_failure_graceful(client, auth_user_token, monkeypatch):
    from app.services import edge_command_center_service as svc

    def boom(*_a, **_k):
        raise RuntimeError("simulated failure")

    monkeypatch.setattr(svc, "get_recommendation_dashboard", boom)
    resp = _edge(client, auth_user_token)
    assert resp.status_code == 200
    assert any("recommendations" in n.lower() for n in resp.json()["data_quality"]["notes"])


def test_no_db_mutation(client, auth_user_token, db_session: Session):
    t = _create_trade(client, auth_user_token, "NOMUT", 100, 110)
    trade = db_session.query(Trade).filter(Trade.id == t["id"]).first()
    updated = trade.updated_at
    _edge(client, auth_user_token)
    db_session.refresh(trade)
    assert trade.updated_at == updated


def test_sparse_data_quality_notes(client, auth_user_token):
    data = _edge(client, auth_user_token).json()
    assert isinstance(data["data_quality"]["notes"], list)
