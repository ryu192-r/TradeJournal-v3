"""Tests for GET /api/v1/actions/inbox."""

from datetime import datetime

from app.models.daily_journal import DailyJournal


def _create_trade(client, token: str, symbol: str, exit_price: float | None = 110) -> dict:
    payload = {
        "symbol": symbol,
        "entry_price": "100",
        "quantity": "10",
        "direction": "LONG",
        "setup": "Breakout",
        "entry_time": datetime.utcnow().isoformat(),
        "stop_price": "95",
    }
    if exit_price is not None:
        payload["exit_price"] = str(exit_price)
        payload["exit_time"] = datetime.utcnow().isoformat()
    resp = client.post("/api/v1/trades/", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _inbox(client, token: str | None = None, query: str = ""):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.get(f"/api/v1/actions/inbox{query}", headers=headers)


def test_actions_inbox_requires_auth(client):
    assert _inbox(client).status_code == 401


def test_actions_inbox_empty_starter(client, auth_user_token):
    resp = _inbox(client, auth_user_token)
    assert resp.status_code == 200
    data = resp.json()
    assert "generated_at" in data
    assert data["open_count"] >= 0
    assert isinstance(data["items"], list)
    assert isinstance(data["sections"], list)


def test_unreviewed_trade_surfaces(client, auth_user_token):
    _create_trade(client, auth_user_token, "INBOX1", 108)
    data = _inbox(client, auth_user_token).json()
    ids = {item["id"] for item in data["items"]}
    assert any(i.startswith("unreviewed-") or i.startswith("review-queue-") for i in ids)


def test_simple_mode_excludes_pro_tier(client, auth_user_token):
    simple = _inbox(client, auth_user_token, "?interface_mode=simple").json()
    pro = _inbox(client, auth_user_token, "?interface_mode=pro").json()
    assert simple["interface_mode"] == "simple"
    assert pro["interface_mode"] == "pro"
    assert pro["open_count"] >= simple["open_count"]


def test_journal_rule_violation(client, auth_user_token, db_session):
    from app.models.user import User

    user = db_session.query(User).filter(User.email == "pytest@example.com").first()
    today = datetime.utcnow().date()
    db_session.add(
        DailyJournal(
            user_id=user.id,
            date=today,
            rules_violated="Chased entry without plan",
        )
    )
    db_session.commit()
    data = _inbox(client, auth_user_token).json()
    assert any(item["type"] == "rule_violation" for item in data["items"])


def test_item_shape(client, auth_user_token):
    _create_trade(client, auth_user_token, "SHAPE1", 105)
    data = _inbox(client, auth_user_token).json()
    if not data["items"]:
        return
    item = data["items"][0]
    for key in (
        "id", "type", "title", "severity", "status", "source",
        "created_at", "target",
    ):
        assert key in item
    assert item["severity"] in ("info", "warning", "critical")
    assert item["status"] == "open"


def test_items_sorted_critical_before_info(client, auth_user_token, db_session):
    from app.models.user import User

    user = db_session.query(User).filter(User.email == "pytest@example.com").first()
    today = datetime.utcnow().date()
    db_session.add(
        DailyJournal(
            user_id=user.id,
            date=today,
            rules_violated="Late entry",
        )
    )
    db_session.commit()
    _create_trade(client, auth_user_token, "SORT1", 105)
    data = _inbox(client, auth_user_token).json()
    items = data["items"]
    if len(items) < 2:
        return
    ranks = {"critical": 0, "warning": 1, "info": 2}
    for i in range(len(items) - 1):
        assert ranks[items[i]["severity"]] <= ranks[items[i + 1]["severity"]]


def test_open_count_matches_items(client, auth_user_token):
    _create_trade(client, auth_user_token, "COUNT1", 108)
    data = _inbox(client, auth_user_token).json()
    assert data["open_count"] == len(data["items"])


def test_stable_ids_no_index_only_risk_summary(client, auth_user_token):
    _create_trade(client, auth_user_token, "STABLE1", 110)
    a = _inbox(client, auth_user_token).json()
    b = _inbox(client, auth_user_token).json()
    assert {i["id"] for i in a["items"]} == {i["id"] for i in b["items"]}
    assert not any(i["id"].startswith("edge-risk-summary-") for i in a["items"])



# ─── Improvement Loop reminders (issue #73) ───

def _make_focus(db_session, user_id: int, *, due_session, status="active", title="Test focus") -> int:
    from app.models.performance_os import ImprovementAction
    a = ImprovementAction(
        user_id=user_id,
        title=title,
        status=status,
        due_session=due_session,
        contract_type="manual_check",
        contract_params={},
        source_evidence={},
        is_daily_focus=True,
    )
    db_session.add(a)
    db_session.commit()
    db_session.refresh(a)
    return a.id


def _user_id(db_session, email="pytest@example.com") -> int:
    from app.models.user import User
    return db_session.query(User).filter(User.email == email).first().id


def test_active_focus_today_emits_reminder(client, auth_user_token, db_session):
    from datetime import date as date_type
    uid = _user_id(db_session)
    _make_focus(db_session, uid, due_session=date_type.today(), title="Wait for confirmation")
    data = _inbox(client, auth_user_token).json()
    matched = [i for i in data["items"] if i["id"].startswith("improvement-focus-")]
    assert len(matched) == 1
    item = matched[0]
    assert item["type"] == "focus_reminder"
    assert item["source"] == "improvement"
    assert item["target"]["view"] == "improvement"
    assert "Wait for confirmation" in item["title"]


def test_overdue_focus_emits_warning_reminder(client, auth_user_token, db_session):
    from datetime import date as date_type, timedelta
    uid = _user_id(db_session)
    _make_focus(db_session, uid, due_session=date_type.today() - timedelta(days=2), title="Yesterday focus")
    data = _inbox(client, auth_user_token).json()
    matched = [i for i in data["items"] if i["id"].startswith("improvement-overdue-")]
    assert len(matched) == 1
    item = matched[0]
    assert item["severity"] == "warning"
    assert item["source"] == "improvement"
    assert item["target"]["view"] == "improvement"


def test_kept_focus_does_not_emit_reminder(client, auth_user_token, db_session):
    from datetime import date as date_type, timedelta
    uid = _user_id(db_session)
    _make_focus(db_session, uid, due_session=date_type.today() - timedelta(days=1), status="kept")
    data = _inbox(client, auth_user_token).json()
    assert not any(i["id"].startswith("improvement-overdue-") for i in data["items"])
    assert not any(i["id"].startswith("improvement-focus-") for i in data["items"])


def test_no_focus_means_no_improvement_reminders(client, auth_user_token):
    data = _inbox(client, auth_user_token).json()
    assert not any(i["source"] == "improvement" for i in data["items"])


def test_other_users_focus_does_not_leak(client, auth_user_token, db_session):
    from datetime import date as date_type
    from app.core.security import get_password_hash
    from app.models.user import User
    other = User(email="other@example.com", full_name="Other", hashed_password=get_password_hash("x"))
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    _make_focus(db_session, other.id, due_session=date_type.today(), title="Other user focus")
    data = _inbox(client, auth_user_token).json()
    assert not any("Other user focus" in i.get("title", "") for i in data["items"])


def test_reminder_ids_are_stable(client, auth_user_token, db_session):
    from datetime import date as date_type
    uid = _user_id(db_session)
    _make_focus(db_session, uid, due_session=date_type.today())
    a = _inbox(client, auth_user_token).json()
    b = _inbox(client, auth_user_token).json()
    a_ids = {i["id"] for i in a["items"] if i["source"] == "improvement"}
    b_ids = {i["id"] for i in b["items"] if i["source"] == "improvement"}
    assert a_ids == b_ids
    assert len(a_ids) >= 1
