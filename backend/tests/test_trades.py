"""Trade CRUD tests — integration-style, through public API."""

TRADE = {
    "symbol": "RELIANCE",
    "direction": "LONG",
    "entry_price": 2500.00,
    "exit_price": 2550.00,
    "quantity": 10,
    "entry_time": "2025-01-13T09:30:00",
    "exit_time": "2025-01-13T10:00:00",
    "status": "open",
}

# ── helpers ──


def _create(client, token, **kw):
    data = {**TRADE, **kw}
    return client.post(
        "/api/v1/trades/", json=data,
        headers={"Authorization": f"Bearer {token}"},
    )


def _list(client, token, **params):
    return client.get(
        "/api/v1/trades/", params=params,
        headers={"Authorization": f"Bearer {token}"},
    )


def _get(client, token, trade_id):
    return client.get(
        f"/api/v1/trades/{trade_id}",
        headers={"Authorization": f"Bearer {token}"},
    )


def _update(client, token, trade_id, **kw):
    return client.put(
        f"/api/v1/trades/{trade_id}", json=kw,
        headers={"Authorization": f"Bearer {token}"},
    )


def _delete(client, token, trade_id):
    return client.delete(
        f"/api/v1/trades/{trade_id}",
        headers={"Authorization": f"Bearer {token}"},
    )


# ── tests ──

def test_create_trade_ok(client, auth_user_token):
    resp = _create(client, auth_user_token)
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    trade = body.get("data", body)
    assert trade["symbol"] == "RELIANCE"


def test_create_trade_computes_pnl(client, auth_user_token):
    resp = _create(client, auth_user_token)
    body = resp.json()
    trade = body.get("data", body)
    pnl = float(trade["pnl"]) if trade.get("pnl") is not None else None
    assert pnl is not None
    assert pnl > 0  # LONG, entry 2500, exit 2550, qty 10 → +500


def test_create_trade_long_only(client, auth_user_token):
    r1 = _create(client, auth_user_token, direction="LONG")
    assert r1.status_code in (200, 201)
    r2 = _create(client, auth_user_token, direction="SHORT")
    assert r2.status_code == 422  # SHORT not supported


def test_create_trade_missing_symbol_422(client, auth_user_token):
    bad = {**TRADE}
    del bad["symbol"]
    resp = client.post(
        "/api/v1/trades/", json=bad,
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 422


def test_create_trade_invalid_direction_422(client, auth_user_token):
    resp = _create(client, auth_user_token, direction="SIDEWAYS")
    assert resp.status_code == 422


def test_create_trade_with_setup(client, auth_user_token):
    resp = _create(client, auth_user_token, setup="EP")
    body = resp.json()
    trade = body.get("data", body)
    assert trade["setup"] == "EP"


def test_list_trades_returns_items(client, auth_user_token):
    _create(client, auth_user_token, symbol="RELIANCE")
    _create(client, auth_user_token, symbol="TCS")
    resp = _list(client, auth_user_token)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2
    assert len(data["items"]) >= 2


def test_list_trades_excludes_deleted(client, auth_user_token):
    r = _create(client, auth_user_token)
    body = r.json()
    trade_id = body.get("data", body)["id"]
    _delete(client, auth_user_token, trade_id)
    resp = _list(client, auth_user_token)
    items = resp.json()["items"]
    ids = [t["id"] for t in items]
    assert trade_id not in ids


def test_list_trades_paginated(client, auth_user_token):
    for s in ["A", "B", "C", "D", "E"]:
        _create(client, auth_user_token, symbol=s)
    resp = _list(client, auth_user_token, skip=0, limit=2)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 5
    assert len(data["items"]) == 2


def test_list_trades_filter_by_status(client, auth_user_token):
    _create(client, auth_user_token, exit_price=None, symbol="X")  # → open
    _create(client, auth_user_token, exit_price=2000, symbol="Z")  # → closed
    resp = _list(client, auth_user_token, status="open")
    items = resp.json()["items"]
    assert all(t["status"] == "open" for t in items)
    assert any(t["symbol"] == "X" for t in items)


def test_get_trade_by_id(client, auth_user_token):
    r = _create(client, auth_user_token, symbol="INFY")
    body = r.json()
    trade_id = body.get("data", body)["id"]
    resp = _get(client, auth_user_token, trade_id)
    assert resp.status_code == 200
    data = resp.json().get("data", resp.json())
    assert data["symbol"] == "INFY"


def test_update_trade(client, auth_user_token):
    r = _create(client, auth_user_token, notes="old")
    body = r.json()
    trade_id = body.get("data", body)["id"]
    resp = _update(client, auth_user_token, trade_id, notes="updated!")
    assert resp.status_code in (200, 201)
    data = resp.json().get("data", resp.json())
    assert data["notes"] == "updated!"


def test_delete_trade_soft(client, auth_user_token):
    r = _create(client, auth_user_token)
    body = r.json()
    trade_id = body.get("data", body)["id"]
    resp = _delete(client, auth_user_token, trade_id)
    assert resp.status_code in (200, 201, 204)  # 204 = No Content (valid success)
    # Verify the trade is now excluded from list
    resp = _list(client, auth_user_token)
    ids = [t["id"] for t in resp.json()["items"]]
    assert trade_id not in ids


def test_list_trades_filter_by_symbol(client, auth_user_token):
    _create(client, auth_user_token, symbol="UNIQUE_SYM")
    _create(client, auth_user_token, symbol="OTHER_SYM")
    resp = _list(client, auth_user_token, symbol="UNIQUE_SYM")
    items = resp.json()["items"]
    assert all(t["symbol"] == "UNIQUE_SYM" for t in items)


def test_reentry_after_close_creates_separate_trade(client, auth_user_token):
    trade1 = _create(client, auth_user_token, symbol="RELIANCE", quantity=10,
                     entry_price=2500, exit_price=2550,
                     entry_time="2025-01-15T09:30:00", exit_time="2025-01-15T10:00:00")
    body1 = trade1.json()
    t1 = body1.get("data", body1)
    assert t1["status"] == "closed"
    assert float(t1["quantity"]) == 10

    trade2 = _create(client, auth_user_token, symbol="RELIANCE", quantity=5,
                     entry_price=2520, exit_price=None,
                     entry_time="2025-01-15T11:00:00")
    body2 = trade2.json()
    t2 = body2.get("data", body2)
    assert t2["status"] == "open", "Re-entry should be a new open trade, not merged into closed"
    assert float(t2["quantity"]) == 5, "Re-entry quantity should be 5, not merged 15"
    assert t2["id"] != t1["id"], "Re-entry should be a separate trade record"

    resp = _list(client, auth_user_token, symbol="RELIANCE")
    items = resp.json()["items"]
    assert len(items) == 2, "Should have 2 separate trades for same-day re-entry"
    closed_trades = [t for t in items if t["status"] == "closed"]
    open_trades = [t for t in items if t["status"] == "open"]
    assert len(closed_trades) == 1
    assert len(open_trades) == 1
    assert float(closed_trades[0]["quantity"]) == 10
    assert float(open_trades[0]["quantity"]) == 5


def test_open_then_closed_same_day_creates_separate(client, auth_user_token):
    trade1 = _create(client, auth_user_token, symbol="TCS", quantity=10,
                     entry_price=3800, exit_price=None,
                     entry_time="2025-02-10T09:30:00")
    body1 = trade1.json()
    t1 = body1.get("data", body1)
    assert t1["status"] == "open"

    trade2 = _create(client, auth_user_token, symbol="TCS", quantity=10,
                     entry_price=3800, exit_price=3850,
                     entry_time="2025-02-10T09:45:00", exit_time="2025-02-10T11:00:00")
    body2 = trade2.json()
    t2 = body2.get("data", body2)
    assert t2["status"] == "closed", "Closing entry should be separate, not merged into open"
    assert t2["id"] != t1["id"], "Closing entry should be a separate trade record"


def test_two_open_trades_same_day_merge(client, auth_user_token):
    trade1 = _create(client, auth_user_token, symbol="INFY", quantity=10,
                     entry_price=1500, exit_price=None,
                     entry_time="2025-03-01T09:30:00")
    body1 = trade1.json()
    t1_id = body1.get("data", body1)["id"]

    trade2 = _create(client, auth_user_token, symbol="INFY", quantity=5,
                     entry_price=1510, exit_price=None,
                     entry_time="2025-03-01T10:00:00")
    body2 = trade2.json()
    t2 = body2.get("data", body2)
    assert t2["id"] == t1_id, "Two open entries same day should merge (pyramid)"
    assert float(t2["quantity"]) == 15


def test_two_closed_trades_same_day_merge(client, auth_user_token):
    trade1 = _create(client, auth_user_token, symbol="HDFCBANK", quantity=10,
                     entry_price=1600, exit_price=1650,
                     entry_time="2025-04-01T09:30:00", exit_time="2025-04-01T10:00:00")
    body1 = trade1.json()
    t1_id = body1.get("data", body1)["id"]

    trade2 = _create(client, auth_user_token, symbol="HDFCBANK", quantity=5,
                     entry_price=1610, exit_price=1670,
                     entry_time="2025-04-01T09:45:00", exit_time="2025-04-01T10:30:00")
    body2 = trade2.json()
    t2 = body2.get("data", body2)
    assert t2["id"] == t1_id, "Two closed entries same day should merge"
    assert float(t2["quantity"]) == 15
