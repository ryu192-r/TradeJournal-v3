"""Trade Ideas tests — integration-style, through public API."""


def _create_idea(client, token, **kw):
    data = {
        "symbol": "TATASTEEL",
        "direction": "LONG",
        "thesis": "Strong momentum on daily chart",
        "confidence": "HIGH",
        "entry_price": 150.0,
        "stop_price": 145.0,
        "target_price": 165.0,
        **kw,
    }
    return client.post(
        "/api/v1/ideas/", json=data,
        headers={"Authorization": f"Bearer {token}"},
    )


def test_create_idea_ok(client, auth_user_token):
    resp = _create_idea(client, auth_user_token)
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    idea = body.get("data", body)
    assert idea["symbol"] == "TATASTEEL"


def test_list_ideas(client, auth_user_token):
    _create_idea(client, auth_user_token, symbol="IDEA_A")
    _create_idea(client, auth_user_token, symbol="IDEA_B")
    resp = client.get(
        "/api/v1/ideas/",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    items = data.get("items", data.get("data", []))
    assert len(items) >= 2


def test_update_idea_status(client, auth_user_token):
    r = _create_idea(client, auth_user_token)
    idea = r.json().get("data", r.json())
    idea_id = idea["id"]
    resp = client.put(
        f"/api/v1/ideas/{idea_id}",
        json={"status": "active"},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 201)
    data = resp.json().get("data", resp.json())
    assert data["status"] == "active"


def test_patch_update_route_removed(client, auth_user_token):
    r = _create_idea(client, auth_user_token)
    idea = r.json().get("data", r.json())
    idea_id = idea["id"]

    resp = client.patch(
        f"/api/v1/ideas/{idea_id}",
        json={"status": "active"},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )

    assert resp.status_code == 405

    get_resp = client.get(
        f"/api/v1/ideas/{idea_id}",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["status"] == "draft"


def test_put_update_route_is_canonical(client, auth_user_token):
    r = _create_idea(client, auth_user_token, symbol="CANONICAL")
    idea = r.json().get("data", r.json())
    idea_id = idea["id"]

    resp = client.put(
        f"/api/v1/ideas/{idea_id}",
        json={"status": "active", "thesis": "Updated thesis"},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "active"
    assert data["thesis"] == "Updated thesis"


def test_convert_idea_to_trade(client, auth_user_token):
    r = _create_idea(client, auth_user_token)
    idea = r.json().get("data", r.json())
    idea_id = idea["id"]
    # Activate first
    client.put(
        f"/api/v1/ideas/{idea_id}",
        json={"status": "active"},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    resp = client.post(
        f"/api/v1/ideas/{idea_id}/trade",
        json={
            "quantity": 10,
            "entry_time": "2025-08-11T09:30:00",
            "notes": "From idea",
        },
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 201, 202), resp.text


def test_delete_idea(client, auth_user_token):
    r = _create_idea(client, auth_user_token)
    idea = r.json().get("data", r.json())
    idea_id = idea["id"]
    resp = client.delete(
        f"/api/v1/ideas/{idea_id}",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 204)


def test_list_ideas_filter_by_status(client, auth_user_token):
    _create_idea(client, auth_user_token, symbol="DR_TEST")
    _create_idea(client, auth_user_token, symbol="DR_TEST_2")
    resp = client.get(
        "/api/v1/ideas/?status=draft",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    items = resp.json().get("items", [])
    assert all(i["status"] == "draft" for i in items)
