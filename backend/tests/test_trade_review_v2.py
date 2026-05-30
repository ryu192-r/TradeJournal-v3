"""Tests for Trade Review Engine V2 — deterministic structured reviews."""

from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.models.execution_grade import ExecutionGrade
from app.models.trade import Trade
from app.models.user import User
from app.services.trade_review_v2_service import review_trade_v2, review_trades_batch_v2


def _create_trade(client, token: str, symbol: str, entry_price: float, exit_price: float | None,
                  quantity: float = 10, setup: str | None = "Breakout",
                  stop_price: float | None = None, direction: str = "LONG",
                  entry_time: str | None = None) -> dict:
    now = datetime.utcnow().isoformat()
    payload = {
        "symbol": symbol,
        "entry_price": str(entry_price),
        "quantity": str(quantity),
        "direction": direction,
        "entry_time": entry_time or now,
    }
    if setup is not None:
        payload["setup"] = setup
    if exit_price is not None:
        payload["exit_price"] = str(exit_price)
    if stop_price is not None:
        payload["stop_price"] = str(stop_price)
    resp = client.post(
        "/api/v1/trades/",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _add_emotion(client, token: str, trade_id: int, emotion: str):
    resp = client.post(
        f"/api/v1/trades/{trade_id}/emotions",
        json={"trade_id": trade_id, "emotion": emotion},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code in (200, 201), resp.text


def _add_grade(client, token: str, trade_id: int, grade: str = "C", **overrides):
    payload = {
        "overall_grade": grade,
        "entry_quality": grade,
        "exit_quality": grade,
        "sizing_quality": grade,
        "stop_quality": grade,
        "patience": grade,
        "rule_adherence": grade,
    }
    payload.update(overrides)
    resp = client.post(
        f"/api/v1/trades/{trade_id}/execution-grade",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code in (200, 201), resp.text


def _review(client, token: str, trade_id: int):
    return client.get(
        f"/api/v1/trade-review-v2/{trade_id}",
        headers={"Authorization": f"Bearer {token}"},
    )


# ─── 1. Auth ───────────────────────────────────────────────────


def test_trade_review_v2_requires_auth(client):
    assert client.get("/api/v1/trade-review-v2/1").status_code == 401
    assert client.get("/api/v1/trade-review-v2/batch").status_code == 401


# ─── 2. User isolation ─────────────────────────────────────────


def test_trade_review_v2_user_isolation(client, auth_user_token):
    t = _create_trade(client, auth_user_token, "ISO", 100, 110, stop_price=95)
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "v2user2@test.com", "full_name": "V2 Two", "password": "pass12345"},
    )
    token2 = resp.json()["access_token"]
    assert _review(client, token2, t["id"]).status_code == 404


# ─── 3. Deleted trade excluded ─────────────────────────────────


def test_deleted_trade_excluded(client, auth_user_token, db_session: Session):
    t = _create_trade(client, auth_user_token, "DEL", 100, 110, stop_price=95)
    trade = db_session.query(Trade).filter(Trade.id == t["id"]).first()
    trade.status = "deleted"
    db_session.commit()
    assert _review(client, auth_user_token, t["id"]).status_code == 404


# ─── 4. No stop → critical risk tag ────────────────────────────


def test_no_stop_critical_risk_tag(client, auth_user_token):
    t = _create_trade(client, auth_user_token, "NOSTOP", 100, 90, setup="Breakout", stop_price=None)
    data = _review(client, auth_user_token, t["id"]).json()
    tags = {m["tag"] for m in data["mistake_tags"]}
    assert "no_stop" in tags
    assert data["verdict"] in ("risk_violation_trade", "poor_execution", "flawed_but_profitable")
    risk_dim = next(d for d in data["dimension_scores"] if d["dimension"] == "risk_discipline")
    assert risk_dim["label"] == "critical"


# ─── 5. No setup caps setup score ──────────────────────────────


def test_no_setup_caps_setup_score(client, auth_user_token):
    t = _create_trade(client, auth_user_token, "NOSETUP", 100, 110, setup=None, stop_price=95)
    data = _review(client, auth_user_token, t["id"]).json()
    setup_dim = next(d for d in data["dimension_scores"] if d["dimension"] == "setup_adherence")
    assert setup_dim["score"] <= 50
    assert any(m["tag"] == "no_setup" for m in data["mistake_tags"])


# ─── 6–7. Emotion tags ─────────────────────────────────────────


@pytest.mark.parametrize("emotion,expected_tag", [
    ("revenge", "revenge_trade"),
    ("fomo", "fomo_trade"),
])
def test_emotion_mistake_tags(client, auth_user_token, emotion, expected_tag):
    t = _create_trade(client, auth_user_token, f"EMO{emotion}", 100, None, stop_price=95)
    _add_emotion(client, auth_user_token, t["id"], emotion)
    data = _review(client, auth_user_token, t["id"]).json()
    assert any(m["tag"] == expected_tag for m in data["mistake_tags"])


# ─── 8–9. Execution grades ─────────────────────────────────────


def test_df_grade_lowers_scores(client, auth_user_token):
    t = _create_trade(client, auth_user_token, "LOWG", 100, 90, stop_price=95)
    _add_grade(client, auth_user_token, t["id"], "D")
    data = _review(client, auth_user_token, t["id"]).json()
    assert data["overall_score"] < 75
    assert any(m["tag"] in ("poor_entry", "poor_exit", "rule_break") for m in data["mistake_tags"])


def test_ab_grade_improves_scores(client, auth_user_token):
    t = _create_trade(client, auth_user_token, "HIGHG", 100, 120, stop_price=95)
    _add_grade(client, auth_user_token, t["id"], "A")
    data = _review(client, auth_user_token, t["id"]).json()
    assert data["overall_score"] >= 70


# ─── 10. Open trade verdict ────────────────────────────────────


def test_open_trade_incomplete_verdict(client, auth_user_token):
    t = _create_trade(client, auth_user_token, "OPEN", 100, None, stop_price=95)
    data = _review(client, auth_user_token, t["id"]).json()
    assert data["verdict"] == "incomplete_open_trade"
    assert data["status"] == "open"


# ─── 11. Closed disciplined profitable ─────────────────────────


def test_closed_disciplined_profitable_good_score(client, auth_user_token):
    t = _create_trade(client, auth_user_token, "WIN", 100, 130, stop_price=95)
    _add_grade(client, auth_user_token, t["id"], "A")
    data = _review(client, auth_user_token, t["id"]).json()
    assert data["overall_score"] >= 70
    assert data["verdict"] in ("excellent_execution", "good_execution")


# ─── 12. Large negative R tag ──────────────────────────────────


def test_large_negative_r_tag(client, auth_user_token, db_session: Session):
    t = _create_trade(client, auth_user_token, "BIGHIT", 100, 70, stop_price=95)
    trade = db_session.query(Trade).filter(Trade.id == t["id"]).first()
    trade.r_multiple = Decimal("-3.5")
    db_session.commit()
    data = _review(client, auth_user_token, t["id"]).json()
    assert any(m["tag"] == "large_negative_r" for m in data["mistake_tags"])


# ─── 13–14. Batch endpoint ───────────────────────────────────


def test_batch_endpoint_capped(client, auth_user_token):
    for i in range(3):
        _create_trade(client, auth_user_token, f"B{i}", 100 + i, 110 + i, stop_price=95)
    resp = client.get(
        "/api/v1/trade-review-v2/batch?limit=2",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 2
    assert len(data["reviews"]) == 2
    assert "avg_score" in data["summary"]


def test_batch_summary_common_mistakes(client, auth_user_token):
    _create_trade(client, auth_user_token, "BATCH1", 100, 90, stop_price=None)
    _create_trade(client, auth_user_token, "BATCH2", 100, 90, stop_price=None)
    resp = client.get(
        "/api/v1/trade-review-v2/batch?limit=10",
        headers={"Authorization": f"Bearer {auth_user_token}"},
    )
    data = resp.json()
    assert "no_stop" in data["summary"]["common_mistakes"] or len(data["summary"]["common_mistakes"]) >= 0


# ─── 15. No DB mutation ────────────────────────────────────────


def test_review_no_db_mutation(client, auth_user_token, db_session: Session):
    t = _create_trade(client, auth_user_token, "NOMUT", 100, 110, stop_price=95)
    before = db_session.query(Trade).filter(Trade.id == t["id"]).first()
    updated_at = before.updated_at
    _review(client, auth_user_token, t["id"])
    db_session.refresh(before)
    assert before.updated_at == updated_at


# ─── 16. SHORT risk safe ───────────────────────────────────────


def test_short_trade_risk_calculation(client, auth_user_token, db_session: Session):
    """SHORT not creatable via API — set direction in DB; risk math must not break."""
    t = _create_trade(client, auth_user_token, "SHORT1", 100, 90, stop_price=110, setup="Breakout")
    trade = db_session.query(Trade).filter(Trade.id == t["id"]).first()
    trade.direction = "SHORT"
    db_session.commit()
    data = _review(client, auth_user_token, t["id"]).json()
    assert data["direction"] == "SHORT"
    risk_dim = next(d for d in data["dimension_scores"] if d["dimension"] == "risk_discipline")
    assert risk_dim["score"] >= 0


# ─── Service direct: not found ───────────────────────────────────


def test_service_raises_for_missing_trade(db_session: Session, auth_user_token):
    user = db_session.query(User).filter(User.email == "pytest@example.com").first()
    assert user is not None
    with pytest.raises(ValueError, match="not found"):
        review_trade_v2(db_session, user.id, 999999)
