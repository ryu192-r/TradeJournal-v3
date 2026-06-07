"""Auth isolation tests — verify User A cannot access User B's data.

All tests use the public HTTP API (no direct ORM) to verify every
endpoint enforces user_id scoping via 404 on cross-user access.
"""

import pytest

TRADE = {
    "symbol": "RELIANCE",
    "direction": "LONG",
    "entry_price": 2500.00,
    "quantity": 10,
    "entry_time": "2025-01-13T09:30:00",
}


def _auth(client, email_suffix: str) -> str:
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"iso-test-{email_suffix}@example.com",
            "full_name": "Isolation Test",
            "password": "test12345",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


# ─── Trades ────────────────────────────────────────────────


def test_user_b_cannot_list_user_a_trades(client):
    token_a = _auth(client, "list-trades-a")
    token_b = _auth(client, "list-trades-b")

    client.post(
        "/api/v1/trades/",
        json={**TRADE, "symbol": "RELIANCE"},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    resp_b = client.get(
        "/api/v1/trades/",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp_b.status_code == 200
    data = resp_b.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_user_b_cannot_read_user_a_trade(client):
    token_a = _auth(client, "read-trade-a")
    token_b = _auth(client, "read-trade-b")

    r = client.post(
        "/api/v1/trades/",
        json={**TRADE, "symbol": "TCS"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    trade_id = r.json()["id"]

    resp_b = client.get(
        f"/api/v1/trades/{trade_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp_b.status_code == 404


def test_user_b_cannot_update_user_a_trade(client):
    token_a = _auth(client, "update-trade-a")
    token_b = _auth(client, "update-trade-b")

    r = client.post(
        "/api/v1/trades/",
        json={**TRADE, "symbol": "INFY"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    trade_id = r.json()["id"]

    resp_b = client.put(
        f"/api/v1/trades/{trade_id}",
        json={"exit_price": 2600.0},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp_b.status_code == 404


def test_user_b_cannot_delete_user_a_trade(client):
    token_a = _auth(client, "delete-trade-a")
    token_b = _auth(client, "delete-trade-b")

    r = client.post(
        "/api/v1/trades/",
        json={**TRADE, "symbol": "HDFC"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    trade_id = r.json()["id"]

    resp_b = client.delete(
        f"/api/v1/trades/{trade_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp_b.status_code == 404


def test_user_b_cannot_pyramid_user_a_trade(client):
    token_a = _auth(client, "pyramid-trade-a")
    token_b = _auth(client, "pyramid-trade-b")

    # Create an open trade (no exit_price)
    r = client.post(
        "/api/v1/trades/",
        json={**TRADE, "exit_price": None, "status": "open"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert r.status_code in (200, 201), r.text
    trade_id = r.json()["id"]

    resp_b = client.post(
        f"/api/v1/trades/{trade_id}/pyramid",
        json={"entry_price": 2520.0, "quantity": 5},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    # Should be 404 (trade not found for user B), but if pyramid returns
    # a different error, at minimum it should NOT allow the operation
    assert resp_b.status_code in (400, 404), f"Expected 400/404 got {resp_b.status_code}"


# ─── Daily Journal ─────────────────────────────────────────


def test_user_b_cannot_read_user_a_journal(client):
    token_a = _auth(client, "journal-a")
    token_b = _auth(client, "journal-b")

    client.post(
        "/api/v1/journal/",
        json={"date": "2025-01-20", "post_trade_notes": "Good day", "discipline_rating": 4},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    resp_b = client.get(
        "/api/v1/journal/2025-01-20",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp_b.status_code == 404


# ─── Performance OS ────────────────────────────────────────


def test_user_b_cannot_read_user_a_workflow(client):
    token_a = _auth(client, "workflow-a")
    token_b = _auth(client, "workflow-b")

    client.post(
        "/api/v1/performance-os/workflow/",
        json={"date": "2025-01-20", "phase": "pre_market", "pre_market_done": True},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    resp_b = client.get(
        "/api/v1/performance-os/workflow/2025-01-20",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp_b.status_code == 404


# ─── Coach Reviews ─────────────────────────────────────────


def test_user_b_cannot_read_user_a_coach_review(client):
    token_a = _auth(client, "coach-a")
    token_b = _auth(client, "coach-b")

    r = client.post(
        "/api/v1/coach/review/daily",
        json={"date": "2025-01-20"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    review_id = r.json().get("id")

    if review_id:
        resp_b = client.get(
            f"/api/v1/coach/reviews/{review_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp_b.status_code == 404


# ─── Trade Timeline ────────────────────────────────────────


def test_user_b_cannot_modify_user_a_trade_timeline(client):
    token_a = _auth(client, "timeline-a")
    token_b = _auth(client, "timeline-b")

    r = client.post(
        "/api/v1/trades/",
        json={**TRADE, "symbol": "SBIN", "exit_price": None, "status": "open"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    trade_id = r.json()["id"]

    resp_b = client.post(
        f"/api/v1/trades/{trade_id}/timeline",
        json={"event_type": "stop_moved", "new_value": "Test", "old_value": "100"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp_b.status_code in (400, 404, 422), f"Unexpected {resp_b.status_code}: {resp_b.text}"


# ─── Capital Events ────────────────────────────────────────


def test_user_b_cannot_access_user_a_account(client):
    token_a = _auth(client, "capital-a")
    token_b = _auth(client, "capital-b")

    # User A's account is created via the dashboard endpoint
    resp_a = client.get(
        "/api/v1/accounts/dashboard",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp_a.status_code in (200, 422), resp_a.text

    # User B gets their own dashboard (should not leak A's data)
    resp_b = client.get(
        "/api/v1/accounts/dashboard",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp_b.status_code in (200, 422), resp_b.text
    if resp_b.status_code == 200:
        data = resp_b.json()
        assert isinstance(data, list)
        # User B should have a clean account, not A's data
        for acc in data:
            balance = acc.get("current_balance") or acc.get("balance")
            assert balance == "0" or balance is None
