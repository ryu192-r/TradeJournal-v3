"""Tests for trade CRUD endpoints: create, list, read, update, delete."""

import sys, os

_app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _app_dir not in sys.path:
    sys.path.insert(0, _app_dir)


# ── Create Trade ─────────────────────────────────────────────────


class TestCreateTrade:
    """POST /api/v1/trades/"""

    def test_create_trade(self, client, sample_trade_data):
        resp = client.post("/api/v1/trades/", json=sample_trade_data)
        assert resp.status_code == 201
        data = resp.json()
        assert data["symbol"] == "TESTCO"
        assert data["direction"] == "LONG"
        assert data["status"] == "draft"
        assert "id" in data
        return data["id"]

    def test_create_short_trade(self, client):
        resp = client.post("/api/v1/trades/", json={
            "symbol": "INFY",
            "direction": "SHORT",
            "entry_price": "1500.00",
            "quantity": "20",
            "entry_time": "2026-01-15T09:30:00",
            "fees": "5.00",
        })
        assert resp.status_code == 201
        assert resp.json()["direction"] == "SHORT"

    def test_create_trade_missing_fields(self, client):
        """Missing required fields → 422."""
        resp = client.post("/api/v1/trades/", json={"symbol": "TCS"})
        assert resp.status_code == 422

    def test_create_trade_invalid_direction(self, client):
        resp = client.post("/api/v1/trades/", json={
            "symbol": "TCS",
            "direction": "INVALID",
            "entry_price": "100.00",
            "quantity": "1",
            "entry_time": "2026-01-15T09:30:00",
        })
        assert resp.status_code == 422

    def test_create_trade_defaults_status_to_draft(self, client):
        resp = client.post("/api/v1/trades/", json={
            "symbol": "WIPRO",
            "direction": "LONG",
            "entry_price": "400.00",
            "quantity": "100",
            "entry_time": "2026-01-15T09:30:00",
        })
        assert resp.status_code == 201
        assert resp.json()["status"] == "draft"


# ── List Trades ──────────────────────────────────────────────────


class TestListTrades:
    """GET /api/v1/trades/"""

    def test_list_empty(self, client):
        resp = client.get("/api/v1/trades/")
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "items" in data

    def test_list_returns_created_trades(self, client, sample_trade_data):
        client.post("/api/v1/trades/", json=sample_trade_data)
        resp = client.get("/api/v1/trades/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1

    def test_list_filters_by_symbol(self, client, sample_trade_data):
        symbol = sample_trade_data["symbol"]
        resp = client.get("/api/v1/trades/", params={"symbol": symbol})
        assert resp.status_code == 200
        data = resp.json()
        for item in data["items"]:
            assert item["symbol"] == symbol

    def test_list_excludes_deleted(self, client):
        # Create then soft-delete a trade
        r = client.post("/api/v1/trades/", json={
            "symbol": "DELETE_ME",
            "direction": "LONG",
            "entry_price": "100.00",
            "quantity": "10",
            "entry_time": "2026-01-15T09:30:00",
        })
        trade_id = r.json()["id"]
        client.delete(f"/api/v1/trades/{trade_id}")

        resp = client.get("/api/v1/trades/")
        assert resp.status_code == 200
        deleted_in_list = [i for i in resp.json()["items"] if i["symbol"] == "DELETE_ME"]
        assert len(deleted_in_list) == 0, "Deleted trades should be excluded from list"

    def test_list_pagination(self, client):
        for i in range(5):
            client.post("/api/v1/trades/", json={
                "symbol": f"SYM{i}",
                "direction": "LONG",
                "entry_price": "100.00",
                "quantity": "1",
                "entry_time": "2026-01-15T09:30:00",
            })

        resp_limited = client.get("/api/v1/trades/", params={"limit": 2, "skip": 0})
        assert resp_limited.status_code == 200
        assert len(resp_limited.json()["items"]) <= 2


# ── Read Trade ───────────────────────────────────────────────────


class TestReadTrade:
    """GET /api/v1/trades/{id}"""

    def test_read_existing(self, client, sample_trade_data):
        created = client.post("/api/v1/trades/", json=sample_trade_data).json()
        resp = client.get(f"/api/v1/trades/{created['id']}")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "TESTCO"

    def test_read_nonexistent(self, client):
        resp = client.get("/api/v1/trades/99999")
        assert resp.status_code == 404


# ── Update Trade ─────────────────────────────────────────────────


class TestUpdateTrade:
    """PUT /api/v1/trades/{id}"""

    def test_update_price(self, client, sample_trade_data):
        trade = client.post("/api/v1/trades/", json=sample_trade_data).json()
        trade_id = trade["id"]

        resp = client.put(f"/api/v1/trades/{trade_id}", json={
            "exit_price": "3600.00",
        })
        assert resp.status_code == 200
        assert resp.json()["exit_price"] == "3600.00000000"

    def test_update_notes(self, client, sample_trade_data):
        trade = client.post("/api/v1/trades/", json=sample_trade_data).json()
        resp = client.put(f"/api/v1/trades/{trade['id']}", json={
            "notes": "Great trade, followed the plan.",
        })
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Great trade, followed the plan."

    def test_update_nonexistent(self, client):
        resp = client.put("/api/v1/trades/99999", json={"notes": "test"})
        assert resp.status_code == 404


# ── Status Transitions ──────────────────────────────────────────


class TestStatusTransitions:
    """Validate trade status workflow."""

    def test_draft_to_reviewed(self, client, sample_trade_data):
        trade = client.post("/api/v1/trades/", json=sample_trade_data).json()
        resp = client.put(f"/api/v1/trades/{trade['id']}", json={"status": "reviewed"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "reviewed"

    def test_reviewed_to_analytics(self, client, sample_trade_data):
        trade = client.post("/api/v1/trades/", json=sample_trade_data).json()
        # First move to reviewed
        client.put(f"/api/v1/trades/{trade['id']}", json={"status": "reviewed"})
        # Then to analytics
        resp = client.put(f"/api/v1/trades/{trade['id']}", json={"status": "analytics"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "analytics"

    def test_invalid_transition_draft_to_analytics(self, client, sample_trade_data):
        """Draft → analytics is not a valid direct transition."""
        trade = client.post("/api/v1/trades/", json=sample_trade_data).json()
        resp = client.put(f"/api/v1/trades/{trade['id']}", json={"status": "analytics"})
        assert resp.status_code == 400

    def test_deleted_cannot_be_reviewed(self, client, sample_trade_data):
        trade = client.post("/api/v1/trades/", json=sample_trade_data).json()
        # Delete it
        client.delete(f"/api/v1/trades/{trade['id']}")
        # Try to review a deleted trade
        resp = client.put(f"/api/v1/trades/{trade['id']}", json={"status": "reviewed"})
        assert resp.status_code == 400

    def test_deleted_back_to_draft(self, client, sample_trade_data):
        """Deleted → draft IS a valid transition."""
        trade = client.post("/api/v1/trades/", json=sample_trade_data).json()
        client.delete(f"/api/v1/trades/{trade['id']}")
        resp = client.put(f"/api/v1/trades/{trade['id']}", json={"status": "draft"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "draft"


# ── Delete Trade ─────────────────────────────────────────────────


class TestDeleteTrade:
    """DELETE /api/v1/trades/{id}"""

    def test_soft_delete(self, client, sample_trade_data):
        trade = client.post("/api/v1/trades/", json=sample_trade_data).json()
        resp = client.delete(f"/api/v1/trades/{trade['id']}")
        assert resp.status_code == 204

        # Verify it's now deleted in DB
        read_resp = client.get(f"/api/v1/trades/{trade['id']}")
        assert read_resp.status_code == 200
        assert read_resp.json()["status"] == "deleted"

    def test_delete_nonexistent(self, client):
        resp = client.delete("/api/v1/trades/99999")
        assert resp.status_code == 404


# ── PnL Computation ─────────────────────────────────────────────


class TestPnLComputation:
    """Verify PnL is calculated correctly on create and update."""

    def test_pnl_long_profit(self, client, sample_trade_data):
        """LONG: (exit - entry) * qty - fees = (3550-3500)*10 - 10 = 490"""
        resp = client.post("/api/v1/trades/", json=sample_trade_data)
        pnl = float(resp.json()["pnl"])
        assert pnl == 490.0

    def test_pnl_short_profit(self, client):
        """SHORT: -(exit - entry) * qty - fees = -(1400-1500)*20 - 5 = 1995"""
        resp = client.post("/api/v1/trades/", json={
            "symbol": "INFY",
            "direction": "SHORT",
            "entry_price": "1500.00",
            "exit_price": "1400.00",
            "quantity": "20",
            "entry_time": "2026-01-15T09:30:00",
            "fees": "5.00",
        })
        pnl = float(resp.json()["pnl"])
        assert pnl == 1995.0

    def test_pnl_long_loss(self, client):
        """LONG with exit below entry."""
        resp = client.post("/api/v1/trades/", json={
            "symbol": "LOSS",
            "direction": "LONG",
            "entry_price": "100.00",
            "exit_price": "90.00",
            "quantity": "10",
            "entry_time": "2026-01-15T09:30:00",
            "fees": "2.00",
        })
        pnl = float(resp.json()["pnl"])
        assert pnl == -102.0

    def test_pnl_unrealized_no_exit(self, client):
        """No exit_price → pnl is None."""
        resp = client.post("/api/v1/trades/", json={
            "symbol": "HOLDING",
            "direction": "LONG",
            "entry_price": "100.00",
            "quantity": "10",
            "entry_time": "2026-01-15T09:30:00",
        })
        assert resp.json()["pnl"] is None
