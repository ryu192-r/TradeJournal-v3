"""Analytics endpoint tests — integration-style, through public API."""


def test_kpi_no_trades(client, auth_user_token):
    """KPI endpoint should handle empty data gracefully."""
    resp = client.get(
        "/api/v1/analytics/kpi",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "trade_count" in data or "total" in data


def test_kpi_with_trades(client, auth_user_token):
    """KPI endpoint with trades returns computed metrics."""
    client.post(
        "/api/v1/trades/",
        json={
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": 2500,
            "exit_price": 2600,
            "quantity": 10,
            "entry_time": "2025-01-13T09:30:00",
            "exit_time": "2025-01-13T10:00:00",
            "status": "reviewed",
        },
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    resp = client.get(
        "/api/v1/analytics/kpi",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("trade_count", 0) >= 1


def test_monthly_pnl(client, auth_user_token):
    resp = client.get(
        "/api/v1/analytics/monthly-pnl",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200


def test_r_distribution(client, auth_user_token):
    """R-distribution should handle empty data gracefully."""
    resp = client.get(
        "/api/v1/analytics/r-distribution",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "bins" in data


def test_day_of_week(client, auth_user_token):
    resp = client.get(
        "/api/v1/analytics/day-of-week",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200


def test_time_of_day(client, auth_user_token):
    resp = client.get(
        "/api/v1/analytics/time-of-day",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200


def test_holding_period(client, auth_user_token):
    resp = client.get(
        "/api/v1/analytics/holding-period",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200


def test_streaks(client, auth_user_token):
    resp = client.get(
        "/api/v1/analytics/streaks",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200


def test_setup_performance(client, auth_user_token):
    resp = client.get(
        "/api/v1/analytics/setup-performance",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200


def test_dashboard(client, auth_user_token):
    """Dashboard endpoint returns all sub-sections."""
    resp = client.get(
        "/api/v1/analytics/dashboard",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "kpi" in data


def test_export_csv(client, auth_user_token):
    """CSV endpoint returns CSV or 404 (both valid for empty data)."""
    resp = client.get(
        "/api/v1/export/csv",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 404)
