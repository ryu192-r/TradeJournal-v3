"""HTTP-level integration tests for partial exits through the public API."""

import pytest

TRADE = {
    "symbol": "RELIANCE",
    "direction": "LONG",
    "entry_price": 100.00,
    "quantity": 10,
    "entry_time": "2025-01-13T09:30:00",
}

PARTIAL = {
    "qty": 4,
    "exit_price": 110.00,
    "exit_time": "2025-01-13T10:00:00",
}


def _auth(client, email_suffix: str) -> str:
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"pnl-http-{email_suffix}@example.com",
            "full_name": "HTTP PnL Test",
            "password": "test12345",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestPartialExitAPI:
    def test_create_partial_exit_returns_enriched_trade(self, client, auth_user_token):
        """GET trade after partial exit should include partial_realized_pnl and remaining_qty."""
        r = client.post("/api/v1/trades/", json=TRADE, headers=_headers(auth_user_token))
        trade_id = r.json()["id"]

        r = client.post(
            f"/api/v1/trades/{trade_id}/partial-exits",
            json=PARTIAL,
            headers=_headers(auth_user_token),
        )
        assert r.status_code == 201

        r = client.get(f"/api/v1/trades/{trade_id}", headers=_headers(auth_user_token))
        trade = r.json()
        assert trade["remaining_qty"] is not None
        assert float(trade["remaining_qty"]) == 6.0
        assert trade["partial_realized_pnl"] is not None
        assert float(trade["partial_realized_pnl"]) > 0
        assert trade["weighted_avg_exit_price"] is not None

    def test_delete_partial_exit_updates_remaining_qty(self, client, auth_user_token):
        r = client.post("/api/v1/trades/", json=TRADE, headers=_headers(auth_user_token))
        trade_id = r.json()["id"]

        r = client.post(
            f"/api/v1/trades/{trade_id}/partial-exits",
            json=PARTIAL,
            headers=_headers(auth_user_token),
        )
        exit_id = r.json()["id"]

        r = client.delete(
            f"/api/v1/trades/{trade_id}/partial-exits/{exit_id}",
            headers=_headers(auth_user_token),
        )
        assert r.status_code == 204

        r = client.get(f"/api/v1/trades/{trade_id}", headers=_headers(auth_user_token))
        trade = r.json()
        assert float(trade["remaining_qty"]) == 10.0
        assert trade["partial_realized_pnl"] is None

    def test_closed_trade_pnl_includes_partials(self, client, auth_user_token):
        """Close trade after partial exit: trade.pnl should include partial realized."""
        r = client.post("/api/v1/trades/", json=TRADE, headers=_headers(auth_user_token))
        trade_id = r.json()["id"]

        client.post(
            f"/api/v1/trades/{trade_id}/partial-exits",
            json=PARTIAL,
            headers=_headers(auth_user_token),
        )

        client.put(
            f"/api/v1/trades/{trade_id}",
            json={"exit_price": 120, "exit_time": "2025-01-13T11:00:00"},
            headers=_headers(auth_user_token),
        )

        r = client.get(f"/api/v1/trades/{trade_id}", headers=_headers(auth_user_token))
        trade = r.json()
        assert trade["status"] == "closed"
        assert trade["pnl"] is not None
        pnl = float(trade["pnl"])
        assert pnl > 0

    def test_list_trades_includes_partial_data(self, client, auth_user_token):
        """List trades endpoint includes partial data enrichment."""
        r = client.post("/api/v1/trades/", json=TRADE, headers=_headers(auth_user_token))
        trade_id = r.json()["id"]

        client.post(
            f"/api/v1/trades/{trade_id}/partial-exits",
            json=PARTIAL,
            headers=_headers(auth_user_token),
        )

        r = client.get("/api/v1/trades/", headers=_headers(auth_user_token))
        items = r.json()["items"]
        trade = next(t for t in items if t["id"] == trade_id)
        assert trade["remaining_qty"] is not None
        assert trade["partial_realized_pnl"] is not None

    def test_user_cannot_delete_other_user_partial_exit(self, client):
        token_a = _auth(client, "partial-iso-a")
        token_b = _auth(client, "partial-iso-b")

        r = client.post("/api/v1/trades/", json=TRADE, headers=_headers(token_a))
        trade_id = r.json()["id"]

        r = client.post(
            f"/api/v1/trades/{trade_id}/partial-exits",
            json=PARTIAL,
            headers=_headers(token_a),
        )
        exit_id = r.json()["id"]

        r = client.delete(
            f"/api/v1/trades/{trade_id}/partial-exits/{exit_id}",
            headers=_headers(token_b),
        )
        assert r.status_code in (400, 404)

    def test_update_trade_returns_enriched_response(self, client, auth_user_token):
        """PUT /trades/{id} returns enriched response with partial data."""
        r = client.post("/api/v1/trades/", json=TRADE, headers=_headers(auth_user_token))
        trade_id = r.json()["id"]

        client.post(
            f"/api/v1/trades/{trade_id}/partial-exits",
            json=PARTIAL,
            headers=_headers(auth_user_token),
        )

        r = client.put(
            f"/api/v1/trades/{trade_id}",
            json={"exit_price": 120, "exit_time": "2025-01-13T11:00:00"},
            headers=_headers(auth_user_token),
        )
        trade = r.json()
        assert trade["remaining_qty"] is not None
        assert trade["partial_realized_pnl"] is not None
        assert trade["weighted_avg_exit_price"] is not None

    def test_open_trade_pnl_is_null_not_client_computed(self, client, auth_user_token):
        """Open trade with partials should have pnl=null, not some stale value."""
        r = client.post("/api/v1/trades/", json=TRADE, headers=_headers(auth_user_token))
        trade_id = r.json()["id"]

        client.post(
            f"/api/v1/trades/{trade_id}/partial-exits",
            json=PARTIAL,
            headers=_headers(auth_user_token),
        )

        r = client.get(f"/api/v1/trades/{trade_id}", headers=_headers(auth_user_token))
        trade = r.json()
        assert trade["pnl"] is None
        assert trade["partial_realized_pnl"] is not None

    def test_same_day_manual_trades_create_separate(self, client, auth_user_token):
        """Manual same-day trades for same symbol should create separate records."""
        client.post(
            "/api/v1/trades/",
            json={**TRADE, "entry_time": "2025-05-01T09:30:00"},
            headers=_headers(auth_user_token),
        )
        r2 = client.post(
            "/api/v1/trades/",
            json={**TRADE, "entry_time": "2025-05-01T10:00:00", "quantity": 5},
            headers=_headers(auth_user_token),
        )
        r = client.get("/api/v1/trades/", headers=_headers(auth_user_token))
        items = r.json()["items"]
        same_day = [t for t in items if t["entry_time"].startswith("2025-05-01")]
        assert len(same_day) == 2