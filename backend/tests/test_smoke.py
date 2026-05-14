"""Core health + rate limiting smoke tests."""


def test_health(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


def test_trades_list_pagination(client, auth_user_token):
    resp = client.get(
        "/api/v1/trades/?skip=0&limit=10",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "items" in data


def test_rate_limit_unauthenticated_health_not_limited(client):
    """Health endpoint is explicitly unlimited."""
    for _ in range(5):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
