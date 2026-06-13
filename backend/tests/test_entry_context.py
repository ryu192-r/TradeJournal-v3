"""Tests for entry_context classification on trades."""

TRADE = {
    "symbol": "INFY",
    "direction": "LONG",
    "entry_price": 1500.00,
    "exit_price": 1550.00,
    "quantity": 5,
    "entry_time": "2025-02-01T09:30:00",
    "exit_time": "2025-02-01T10:00:00",
}


def _create(client, token, **kw):
    return client.post(
        "/api/v1/trades/", json={**TRADE, **kw},
        headers={"Authorization": f"Bearer {token}"},
    )


def _update(client, token, trade_id, **kw):
    return client.put(
        f"/api/v1/trades/{trade_id}", json=kw,
        headers={"Authorization": f"Bearer {token}"},
    )


def _body(resp):
    j = resp.json()
    return j.get("data", j)


def test_entry_context_defaults_null(client, auth_user_token):
    resp = _create(client, auth_user_token)
    assert resp.status_code in (200, 201), resp.text
    assert _body(resp)["entry_context"] is None


def test_create_with_entry_context(client, auth_user_token):
    resp = _create(client, auth_user_token, entry_context="planned")
    assert resp.status_code in (200, 201), resp.text
    assert _body(resp)["entry_context"] == "planned"


def test_update_entry_context(client, auth_user_token):
    resp = _create(client, auth_user_token)
    tid = _body(resp)["id"]
    resp2 = _update(client, auth_user_token, tid, entry_context="impulse")
    assert resp2.status_code == 200, resp2.text
    assert _body(resp2)["entry_context"] == "impulse"


def test_clear_entry_context_to_null(client, auth_user_token):
    resp = _create(client, auth_user_token, entry_context="unclear")
    tid = _body(resp)["id"]
    resp2 = _update(client, auth_user_token, tid, entry_context=None)
    assert resp2.status_code == 200, resp2.text
    assert _body(resp2)["entry_context"] is None


def test_invalid_entry_context_rejected(client, auth_user_token):
    resp = _create(client, auth_user_token, entry_context="yolo")
    assert resp.status_code == 422


def test_invalid_entry_context_on_update(client, auth_user_token):
    resp = _create(client, auth_user_token)
    tid = _body(resp)["id"]
    resp2 = _update(client, auth_user_token, tid, entry_context="bad_value")
    assert resp2.status_code == 422
