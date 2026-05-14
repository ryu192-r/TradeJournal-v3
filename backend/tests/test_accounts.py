"""Accounts and capital events tests — integration-style, through public API."""


def test_create_account_ok(client, auth_user_token):
    resp = client.post(
        "/api/v1/accounts/",
        json={
            "name": "Main Account",
            "broker": "Dhan",
            "initial_balance": 100000,
        },
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    acct = body.get("data", body)
    assert acct["name"] == "Main Account"


def test_list_accounts(client, auth_user_token):
    client.post(
        "/api/v1/accounts/",
        json={"name": "Test Account", "initial_balance": 50000},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    resp = client.get(
        "/api/v1/accounts/",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    items = data.get("items", data.get("data", []))
    assert len(items) >= 1


def test_update_account(client, auth_user_token):
    r = client.post(
        "/api/v1/accounts/",
        json={"name": "Orig", "initial_balance": 50000},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    acct = r.json().get("data", r.json())
    acct_id = acct["id"]
    resp = client.put(
        f"/api/v1/accounts/{acct_id}",
        json={"name": "Renamed"},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 201)
    data = resp.json().get("data", resp.json())
    assert data["name"] == "Renamed"


def test_rebalance_account(client, auth_user_token):
    r = client.post(
        "/api/v1/accounts/",
        json={"name": "Rebalance Me", "initial_balance": 50000},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    acct = r.json().get("data", r.json())
    acct_id = acct["id"]
    # RebalanceBody requires new_balance field (not "balance")
    resp = client.patch(
        f"/api/v1/accounts/{acct_id}/rebalance",
        json={"new_balance": 75000},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    result = data.get("data", data)
    assert float(result["new_balance"]) == 75000.0


def test_create_capital_event(client, auth_user_token):
    r = client.post(
        "/api/v1/accounts/",
        json={"name": "Capital Events Acct", "initial_balance": 100000},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    acct = r.json().get("data", r.json())
    acct_id = acct["id"]
    # CapitalEventCreate requires: event_type, amount, timestamp
    resp = client.post(
        "/api/v1/capital-events/",
        json={
            "account_id": acct_id,
            "event_type": "deposit",
            "amount": 25000,
            "timestamp": "2025-05-13T10:00:00",
        },
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 201)


def test_list_capital_events(client, auth_user_token):
    r = client.post(
        "/api/v1/accounts/",
        json={"name": "List Events Acct", "initial_balance": 100000},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    acct = r.json().get("data", r.json())
    acct_id = acct["id"]
    client.post(
        "/api/v1/capital-events/",
        json={
            "account_id": acct_id,
            "event_type": "deposit",
            "amount": 10000,
            "timestamp": "2025-05-13T10:00:00",
        },
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    resp = client.get(
        f"/api/v1/capital-events/?account_id={acct_id}",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    items = data.get("items", data.get("data", []))
    # At least the one we just created
    assert len(items) >= 1


def test_equity_curve(client, auth_user_token):
    r = client.post(
        "/api/v1/accounts/",
        json={"name": "Equity Curve Acct", "initial_balance": 100000},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    acct = r.json().get("data", r.json())
    acct_id = acct["id"]
    resp = client.get(
        f"/api/v1/accounts/{acct_id}/equity-curve",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
