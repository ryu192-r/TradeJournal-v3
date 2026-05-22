"""Operational dashboard regressions."""

from datetime import datetime
from decimal import Decimal

import pytest

from app.db.database import Base, SessionLocal
from app.db.database import engine as real_engine
from app.models.account import Account
from app.models.trade import Trade
from app.routers.operational_dashboard import operational_dashboard


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


def _account():
    return Account(
        name="Primary",
        initial_balance=Decimal("100000.00"),
        current_balance=Decimal("100000.00"),
    )


def _trade(symbol: str, pnl: str):
    return Trade(
        symbol=symbol,
        direction="LONG",
        entry_price=Decimal("100.00"),
        exit_price=Decimal("110.00"),
        quantity=Decimal("10"),
        entry_time=datetime.fromisoformat("2025-01-13T09:30:00"),
        exit_time=datetime.fromisoformat("2025-01-13T10:00:00"),
        status="closed",
        pnl=Decimal(pnl),
    )


def _dashboard_for_pnls(db_session, pnls: list[str]):
    db_session.add(_account())
    for idx, pnl in enumerate(pnls):
        db_session.add(_trade(f"T{idx}", pnl))
    db_session.commit()

    return operational_dashboard(db_session)


def test_operational_dashboard_expectancy_mixed_trades(db_session):
    data = _dashboard_for_pnls(db_session, ["1000.00", "-500.00", "-500.00", "-500.00"])

    assert data.kpi.net_pnl == "-500.0"
    assert data.kpi.expectancy == -125.0


def test_operational_dashboard_expectancy_all_wins(db_session):
    data = _dashboard_for_pnls(db_session, ["100.00", "300.00"])

    assert data.kpi.expectancy == 200.0


def test_operational_dashboard_expectancy_all_losses(db_session):
    data = _dashboard_for_pnls(db_session, ["-100.00", "-300.00"])

    assert data.kpi.expectancy == -200.0


def test_operational_dashboard_expectancy_no_trades(db_session):
    data = _dashboard_for_pnls(db_session, [])

    assert data.kpi.trade_count == 0
    assert data.kpi.expectancy is None
