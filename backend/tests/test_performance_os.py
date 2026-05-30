"""Performance OS regressions."""

from datetime import date, datetime
from decimal import Decimal
from itertools import count

import pytest

from app.core.security import get_password_hash
from app.models.daily_journal import DailyJournal
from app.models.performance_os import MonthlyReview
from app.models.trade import Trade
from app.models.user import User
from app.routers.performance_os import _enrich_monthly, get_workflow_by_date, ensure_workflow, WorkflowEnsureRequest

_email_counter = count(1)


def _make_user(db_session):
    user = User(
        email=f"test_{next(_email_counter)}@example.com",
        full_name="Test User",
        hashed_password=get_password_hash("test123"),
    )
    db_session.add(user)
    db_session.flush()
    return user


def _trade(symbol: str, entry_time: str, user_id: int, pnl: str = "100.00"):
    return Trade(
        symbol=symbol,
        direction="LONG",
        entry_price=Decimal("100.00"),
        exit_price=Decimal("110.00"),
        quantity=Decimal("10"),
        entry_time=datetime.fromisoformat(entry_time),
        exit_time=datetime.fromisoformat(entry_time),
        status="closed",
        pnl=Decimal(pnl),
        user_id=user_id,
    )


def test_workflow_by_date_returns_same_journal_shape_as_today(db_session):
    target = date(2025, 1, 13)
    user = _make_user(db_session)
    db_session.add(
        DailyJournal(
            date=target,
            mood_rating=2,
            discipline_rating=5,
            rules_followed="waited for setup",
            rules_violated="none",
            user_id=user.id,
        )
    )
    db_session.commit()

    ensure_workflow(WorkflowEnsureRequest(date="2025-01-13"), db_session, current_user=user)
    data = get_workflow_by_date(target, db_session, current_user=user)

    assert data.journal == {
        "id": 1,
        "mood_rating": 2,
        "discipline_rating": 5,
        "rules_followed": "waited for setup",
        "rules_violated": "none",
    }


@pytest.mark.parametrize(
    ("month", "included_day"),
    [
        ("2024-02", 29),
        ("2025-02", 28),
        ("2025-04", 30),
        ("2025-01", 31),
    ],
)
def test_monthly_review_includes_all_days_in_month(db_session, month, included_day):
    year, mon = map(int, month.split("-"))
    user = _make_user(db_session)
    review = MonthlyReview(month=month, user_id=user.id)
    db_session.add(review)
    db_session.add(_trade("INCLUDED", f"{year}-{mon:02d}-{included_day:02d}T09:30:00", user.id))
    db_session.add(_trade("EXCLUDED", f"{year}-{mon % 12 + 1:02d}-01T09:30:00", user.id))
    db_session.commit()
    db_session.refresh(review)

    data = _enrich_monthly(db_session, review, user_id=user.id)

    assert data.total_trades == 1
    assert data.total_pnl == "100.00"
