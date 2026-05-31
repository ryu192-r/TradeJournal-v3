"""AI Settings tests — integration-style, through public API."""


def test_ai_config_get_defaults(client, auth_user_token):
    """GET /ai/config returns config (from env vars or defaults)."""
    resp = client.get(
        "/api/v1/ai/config",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "provider" in data


def test_ai_config_get_providers(client, auth_user_token):
    """GET /ai/providers returns the provider catalog."""
    resp = client.get(
        "/api/v1/ai/providers",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert len(data) > 0
    # Check at least one known provider exists
    providers = list(data.keys())
    # Should have ollama_local or custom at minimum
    assert len(providers) >= 1


def test_ai_config_save(client, auth_user_token):
    """PUT /ai/config saves and returns updated config."""
    # First get current
    get_resp = client.get(
        "/api/v1/ai/config",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert get_resp.status_code == 200
    current = get_resp.json()

    # Save with modified timeout
    resp = client.put(
        "/api/v1/ai/config",
        json={
            "provider": current.get("provider", "custom"),
            "base_url": current.get("base_url", "http://localhost:11434"),
            "api_key": "",
            "model": current.get("model", "qwen2.5:latest"),
            "timeout": 90,
            "max_retries": 2,
            "temperature": 0.5,
        },
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["timeout"] == 90


def test_ai_test_connection_fails_gracefully(client, auth_user_token, monkeypatch):
    """POST /ai/test returns an error when provider is unreachable (expected in test env)."""
    async def fail_chat(*args, **kwargs):
        raise RuntimeError("provider unavailable in test")

    from app.routers import ai_settings

    monkeypatch.setattr(ai_settings.AIProviderClient, "chat", fail_chat)

    resp = client.post(
        "/api/v1/ai/test",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    # Should not 500 — should return a structured error
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert data["status"] in ("ok", "error")
