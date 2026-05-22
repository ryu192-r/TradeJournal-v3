"""Performance OS regressions."""

from datetime import date, datetime
from decimal import Decimal

import pytest

from app.db.database import Base, SessionLocal
from app.db.database import engine as real_engine
from app.models.daily_journal import DailyJournal
from app.models.performance_os import MonthlyReview
from app.models.trade import Trade
from app.routers.performance_os import _enrich_monthly, get_workflow_by_date


@pytest.fixture
def db_session():
    Base.metadata.drop_all(bind=real_engine)
    Base.metadata.create_all(bind=real_engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=real_engine)


def _trade(symbol: str, entry_time: str, pnl: str = "100.00"):
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
    )


def test_workflow_by_date_returns_same_journal_shape_as_today(db_session):
    target = date(2025, 1, 13)
    db_session.add(
        DailyJournal(
            date=target,
            mood_rating=2,
            discipline_rating=5,
            rules_followed="waited for setup",
            rules_violated="none",
        )
    )
    db_session.commit()

    data = get_workflow_by_date(target, db_session)

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
    review = MonthlyReview(month=month)
    db_session.add(review)
    db_session.add(_trade("INCLUDED", f"{year}-{mon:02d}-{included_day:02d}T09:30:00"))
    db_session.add(_trade("EXCLUDED", f"{year}-{mon % 12 + 1:02d}-01T09:30:00"))
    db_session.commit()
    db_session.refresh(review)

    data = _enrich_monthly(db_session, review)

    assert data.total_trades == 1
    assert data.total_pnl == "100.00"
