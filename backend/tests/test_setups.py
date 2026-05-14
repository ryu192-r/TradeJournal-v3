"""Setup playbook tests — integration-style, through public API."""


def test_create_setup_ok(client, auth_user_token):
    resp = client.post(
        "/api/v1/setups/",
        json={
            "name": "Test Setup",
            "tactics": [{"name": "Gap & Go", "conditions": ["Pre-market gap > 2%"]}],
            "ideal_conditions": ["High volume day"],
            "rules": ["Enter only after 9:30"],
            "risk_profile": {"max_risk_pct": 1.0, "stop_style": "structure"},
        },
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    setup = body.get("data", body)
    assert setup["name"] == "Test Setup"


def test_list_setups(client, auth_user_token):
    client.post(
        "/api/v1/setups/",
        json={"name": "Setup A", "rules": ["Rule 1"]},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    resp = client.get(
        "/api/v1/setups/",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    items = data.get("items", data.get("data", []))
    assert len(items) >= 1


def test_seed_defaults(client, auth_user_token):
    resp = client.post(
        "/api/v1/setups/seed",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    items = data.get("items", data.get("data", []))
    assert len(items) == 7


def test_update_setup(client, auth_user_token):
    # First create
    r = client.post(
        "/api/v1/setups/",
        json={"name": "To Update", "rules": ["Old rule"]},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    setup = r.json().get("data", r.json())
    setup_id = setup["id"]
    # Update
    resp = client.put(
        f"/api/v1/setups/{setup_id}",
        json={"name": "Updated Name"},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 201)
    data = resp.json().get("data", resp.json())
    assert data["name"] == "Updated Name"


def test_archive_setup(client, auth_user_token):
    r = client.post(
        "/api/v1/setups/",
        json={"name": "To Archive", "rules": ["Rule"]},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    setup = r.json().get("data", r.json())
    setup_id = setup["id"]
    # is_active field accepts string ('active' or 'archived'), not boolean
    resp = client.put(
        f"/api/v1/setups/{setup_id}",
        json={"is_active": "archived"},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code in (200, 201)
    data = resp.json().get("data", resp.json())
    assert data["is_active"] in ("archived", False)


def test_list_setups_filter_active(client, auth_user_token):
    client.post(
        "/api/v1/setups/",
        json={"name": "Active Setup", "rules": ["R"]},
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    resp = client.get(
        "/api/v1/setups/?is_active=true",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    items = data.get("items", data.get("data", []))
    assert all(s["is_active"] is True for s in items)
