"""Operational dashboard regressions."""

from datetime import datetime
from decimal import Decimal
from itertools import count

import pytest
from sqlalchemy import event

from app.core.security import get_password_hash
from app.db.database import Base, SessionLocal
from app.db.database import engine as real_engine
from app.models.account import Account
from app.models.live_quote import LiveQuote
from app.models.trade import Trade
from app.models.user import User
from app.routers.operational_dashboard import operational_dashboard

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


def _account(user_id: int):
    return Account(
        name="Primary",
        initial_balance=Decimal("100000.00"),
        current_balance=Decimal("100000.00"),
        user_id=user_id,
    )


def _trade(symbol: str, pnl: str, user_id: int):
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
        user_id=user_id,
    )


def _open_trade(symbol: str, user_id: int):
    return Trade(
        symbol=symbol,
        direction="LONG",
        entry_price=Decimal("100.00"),
        quantity=Decimal("10"),
        entry_time=datetime.fromisoformat("2025-01-13T09:30:00"),
        status="open",
        fees=Decimal("0"),
        user_id=user_id,
    )


def _dashboard_for_pnls(db_session, pnls: list[str]):
    user = _make_user(db_session)
    db_session.add(_account(user.id))
    for idx, pnl in enumerate(pnls):
        db_session.add(_trade(f"T{idx}", pnl, user.id))
    db_session.commit()

    return operational_dashboard(db_session, current_user=user)


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


def test_operational_dashboard_queries_live_quotes_for_open_symbols_only(db_session):
    user = _make_user(db_session)
    db_session.add(_account(user.id))
    db_session.add(_open_trade("OPENONLY", user.id))
    db_session.add(_trade("CLOSED", "100.00", user.id))
    db_session.add_all(
        [
            LiveQuote(symbol="OPENONLY", ltp=Decimal("150.00")),
            LiveQuote(symbol="CLOSED", ltp=Decimal("999.00")),
        ]
    )
    db_session.commit()

    live_quote_queries: list[tuple[str, object]] = []

    def capture_live_quote_query(conn, cursor, statement, parameters, context, executemany):
        if "FROM live_quotes" in statement:
            live_quote_queries.append((statement, parameters))

    event.listen(real_engine, "before_cursor_execute", capture_live_quote_query)
    try:
        data = operational_dashboard(db_session, current_user=user)
    finally:
        event.remove(real_engine, "before_cursor_execute", capture_live_quote_query)

    assert len(live_quote_queries) == 1
    query_params = str(live_quote_queries[0][1])
    assert "OPENONLY" in query_params
    assert "CLOSED" not in query_params
    assert [trade.symbol for trade in data.open_trades] == ["OPENONLY"]
    assert Decimal(data.capital.unrealized_pnl) == Decimal("500.00")


def test_operational_dashboard_drawdown_uses_realized_exit_date(db_session):
    user = _make_user(db_session)
    db_session.add(_account(user.id))
    winner = _trade("WIN", "1000.00", user.id)
    winner.entry_time = datetime.fromisoformat("2026-05-01T09:30:00")
    winner.exit_time = datetime.fromisoformat("2026-05-01T15:15:00")
    loser = _trade("LOSS", "-5000.00", user.id)
    loser.entry_time = datetime.fromisoformat("2026-05-01T10:00:00")
    loser.exit_time = datetime.fromisoformat("2026-05-02T15:15:00")
    db_session.add_all([winner, loser])
    db_session.commit()

    data = operational_dashboard(db_session, current_user=user)

    assert data.kpi.max_drawdown_amount == 5000.0
