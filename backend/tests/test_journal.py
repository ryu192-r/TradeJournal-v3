"""Daily journal tests — integration-style, through public API."""


def _create_journal(client, token, date="2025-01-13", **kw):
    data = {
        "date": date,
        "pre_trade_notes": "Plan: watch Nifty 23500",
        "post_trade_notes": "Took 2 trades, mixed results",
        "mood_rating": 4,
        **kw,
    }
    return client.post(
        "/api/v1/journal/", json=data,
        headers={"Authorization": f"Bearer {token}"},
    )


def test_journal_create_ok(client, auth_user_token):
    resp = _create_journal(client, auth_user_token)
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    journal = body.get("data", body)
    assert journal["mood_rating"] == 4


def test_journal_duplicate_date_409(client, auth_user_token):
    _create_journal(client, auth_user_token, date="2025-05-01")
    resp = _create_journal(client, auth_user_token, date="2025-05-01")
    assert resp.status_code == 409


def test_journal_get_by_date(client, auth_user_token):
    _create_journal(client, auth_user_token, date="2025-06-01")
    resp = client.get(
        "/api/v1/journal/2025-06-01",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json().get("data", resp.json())
    assert data["mood_rating"] == 4


def test_journal_update_by_date(client, auth_user_token):
    _create_journal(client, auth_user_token, date="2025-07-01", mood_rating=3)
    resp = client.put(
        "/api/v1/journal/2025-07-01",
        json={"mood_rating": 5, "post_trade_notes": "Great day!"},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 201)
    data = resp.json().get("data", resp.json())
    assert data["mood_rating"] == 5


def test_journal_weekly_endpoint(client, auth_user_token):
    # Create entries for a Monday-Friday week
    for day in ["09", "10"]:
        _create_journal(client, auth_user_token, date=f"2025-08-{day}")
    resp = client.get(
        "/api/v1/journal/weekly?week_start=2025-08-04",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    items = data if isinstance(data, list) else data.get("items", data.get("data", []))
    assert len(items) >= 2


def test_journal_weekly_stats_no_trades(client, auth_user_token):
    """Weekly stats should return zeros when no trades exist for the week."""
    resp = client.get(
        "/api/v1/journal/weekly-stats?week_start=2026-05-11",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["trade_count"] == 0
    assert body["total_pnl"] == "0"
    assert body["win_rate"] == "0"
    assert body["avg_r"] == "0.00"
