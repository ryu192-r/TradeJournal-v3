"""Daily charges ledger tests — integration through public API."""

from datetime import date, datetime


def _create_trade(client, token, symbol="RELIANCE", entry_price=2500, exit_price=None, qty=10, entry_time=None, fees=0):
    entry_time = entry_time or datetime.now().isoformat()
    payload = {
        "symbol": symbol,
        "entry_price": entry_price,
        "quantity": qty,
        "entry_time": entry_time,
        "fees": fees,
        "direction": "LONG",
    }
    if exit_price is not None:
        payload["exit_price"] = exit_price
        payload["exit_time"] = entry_time
    return client.post("/api/v1/trades/", json=payload, headers={"Authorization": f"Bearer {token}"})


def _upsert_charges(client, token, trade_date="2025-03-01", **fields):
    data = {
        "trade_date": trade_date,
        "brokerage": 100,
        "stt": 50,
        **fields,
    }
    return client.put(
        f"/api/v1/daily-charges/{trade_date}",
        json=data,
        headers={"Authorization": f"Bearer {token}"},
    )


def test_charges_upsert_create(client, auth_user_token):
    resp = _upsert_charges(client, auth_user_token)
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    record = body.get("data", body)
    assert record["brokerage"] == "100.00000000"
    assert record["stt"] == "50.00000000"
    assert record["total_charges"] == "150.00000000"


def test_charges_get_by_date(client, auth_user_token):
    _upsert_charges(client, auth_user_token, trade_date="2025-04-01")
    resp = client.get(
        "/api/v1/daily-charges/2025-04-01",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    record = body.get("data", body)
    assert record["total_charges"] == "150.00000000"


def test_charges_upsert_update(client, auth_user_token):
    _upsert_charges(client, auth_user_token, trade_date="2025-05-01", brokerage=50)
    resp = _upsert_charges(client, auth_user_token, trade_date="2025-05-01", brokerage=200, stt=75)
    assert resp.status_code in (200, 201)
    body = resp.json()
    record = body.get("data", body)
    assert record["brokerage"] == "200.00000000"
    assert record["total_charges"] == "275.00000000"


def test_charges_missing_returns_404(client, auth_user_token):
    resp = client.get(
        "/api/v1/daily-charges/2025-06-01",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 404


def test_charges_delete(client, auth_user_token):
    _upsert_charges(client, auth_user_token, trade_date="2025-07-01")
    resp = client.delete(
        "/api/v1/daily-charges/2025-07-01",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 204
    resp2 = client.get(
        "/api/v1/daily-charges/2025-07-01",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp2.status_code == 404


def test_charges_list_range(client, auth_user_token):
    _upsert_charges(client, auth_user_token, trade_date="2025-08-01")
    _upsert_charges(client, auth_user_token, trade_date="2025-08-02")
    resp = client.get(
        "/api/v1/daily-charges/?start_date=2025-08-01&end_date=2025-08-02",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    items = body.get("items", body.get("data", []))
    assert len(items) == 2


def test_charges_negative_rejected(client, auth_user_token):
    resp = client.put(
        "/api/v1/daily-charges/2025-09-01",
        json={"trade_date": "2025-09-01", "brokerage": -10},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 422


def test_charges_summary_pending(client, auth_user_token):
    # Create a closed trade with realized PnL on 2025-10-01
    t = _create_trade(
        client, auth_user_token, entry_price=100, exit_price=110, qty=10,
        entry_time="2025-10-01T10:00:00", fees=0,
    )
    assert t.status_code in (200, 201)
    resp = client.get(
        "/api/v1/daily-charges/summary?start_date=2025-10-01&end_date=2025-10-01",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["trading_days"] == 1
    assert body["missing_charge_days"] == 1
    assert body["charges_recorded_days"] == 0
    day = body["days"][0]
    assert day["charges_recorded"] is False
    assert day["total_charges"] is None
    assert day["net_realized_pnl"] is None


def test_charges_summary_with_charges(client, auth_user_token):
    # trade on 2025-11-01
    t = _create_trade(
        client, auth_user_token, entry_price=100, exit_price=110, qty=10,
        entry_time="2025-11-01T10:00:00", fees=0,
    )
    assert t.status_code in (200, 201)
    _upsert_charges(client, auth_user_token, trade_date="2025-11-01", brokerage=20, stt=10)
    resp = client.get(
        "/api/v1/daily-charges/summary?start_date=2025-11-01&end_date=2025-11-01",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["charges_recorded_days"] == 1
    assert body["missing_charge_days"] == 0
    # gross = (110-100)*10 = 100, charges = 30, net = 70
    assert body["gross_realized_pnl"] == "100.00000000"
    assert body["total_charges"] == "30.00000000"
    assert body["net_realized_pnl"] == "70.00000000"
    day = body["days"][0]
    assert day["charges_recorded"] is True
    assert day["total_charges"] == "30.00000000"
    assert day["net_realized_pnl"] == "70.00000000"


def test_charges_user_isolation(client, auth_user_token):
    _upsert_charges(client, auth_user_token, trade_date="2025-12-01")
    # Register second user
    r = client.post("/api/v1/auth/register", json={
        "email": "other@example.com", "full_name": "Other", "password": "oth12345",
    })
    assert r.status_code == 201
    other_token = r.json()["access_token"]
    resp = client.get(
        "/api/v1/daily-charges/2025-12-01",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404


def test_charges_deleted_trades_excluded_from_gross(client, auth_user_token):
    # closed trade on 2026-01-01
    t = _create_trade(
        client, auth_user_token, entry_price=100, exit_price=110, qty=10,
        entry_time="2026-01-01T10:00:00", fees=0,
    )
    assert t.status_code in (200, 201)
    trade_id = t.json().get("id", t.json().get("data", {}).get("id"))
    # delete trade
    d = client.delete(f"/api/v1/trades/{trade_id}", headers={"Authorization": f"Bearer {auth_user_token}"})
    assert d.status_code in (200, 204)
    # add charges
    _upsert_charges(client, auth_user_token, trade_date="2026-01-01", brokerage=0, stt=0)
    resp = client.get(
        "/api/v1/daily-charges/summary?start_date=2026-01-01&end_date=2026-01-01",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["trading_days"] == 0
    assert body["gross_realized_pnl"] is None


def test_charges_partial_exit_not_double_counted(client, auth_user_token):
    # open trade with partial exit on 2026-02-01
    t = _create_trade(
        client, auth_user_token, entry_price=100, exit_price=None, qty=20,
        entry_time="2026-02-01T10:00:00", fees=10,
    )
    assert t.status_code in (200, 201)
    trade_id = t.json().get("id", t.json().get("data", {}).get("id"))
    # partial exit
    p = client.post(
        f"/api/v1/trades/{trade_id}/partial-exits",
        json={"qty": 10, "exit_price": 110, "exit_time": "2026-02-01T12:00:00", "realized_pnl": 100},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert p.status_code == 201, p.text
    # charges for day
    _upsert_charges(client, auth_user_token, trade_date="2026-02-01", brokerage=10, stt=5)
    resp = client.get(
        "/api/v1/daily-charges/summary?start_date=2026-02-01&end_date=2026-02-01",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    # open trade with partial exit = not closed; day gross should be 0 / none
    assert body["trading_days"] == 0
    assert body["gross_realized_pnl"] is None
    # charges recorded but no closed trades that day -> charges_recorded_days stays 0
    assert body["charges_recorded_days"] == 0


def test_charges_summary_no_trades_empty(client, auth_user_token):
    resp = client.get(
        "/api/v1/daily-charges/summary?start_date=2026-03-01&end_date=2026-03-01",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["trading_days"] == 0
    assert body["charges_recorded_days"] == 0
    assert body["missing_charge_days"] == 0
    assert body["days"] == []
