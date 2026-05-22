"""Market context regressions."""

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from app.db.database import Base, SessionLocal
from app.db.database import engine as real_engine
from app.models.market_snapshot import MarketSnapshot
from app.models.live_quote import LiveQuote
from app.models.trade import Trade
from app.routers.market_context import get_live_quotes, performance_correlation, sync_live_quotes
from app.services import market_data_service
from app.services.live_quote_sync import get_open_trade_symbols, is_market_open


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


def _trade(symbol: str, entry_time: str, pnl: str):
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


def test_performance_correlation_regime_insight_uses_avg_pnl(db_session):
    db_session.add_all(
        [
            MarketSnapshot(date=date(2025, 1, 13), nifty_trend="uptrend", nifty_regime="bullish"),
            MarketSnapshot(date=date(2025, 1, 14), nifty_trend="downtrend", nifty_regime="bearish"),
            _trade("WINNER", "2025-01-13T09:30:00", "1234.56"),
            _trade("LOSER", "2025-01-14T09:30:00", "-100.00"),
        ]
    )
    db_session.commit()

    data = performance_correlation(None, None, db_session)

    assert data["by_regime"]["bullish"]["avg_pnl"] == 1234.56
    assert any(
        item["message"] == "You trade best in bullish markets (avg ₹1234.56 PnL, 100.0% win rate)."
        for item in data["insights"]
    )


def test_live_quotes_include_freshness_status(db_session):
    db_session.add_all(
        [
            LiveQuote(
                symbol="FRESH",
                ltp=Decimal("100.00"),
                updated_at=datetime.utcnow(),
            ),
            LiveQuote(
                symbol="STALE",
                ltp=Decimal("200.00"),
                updated_at=datetime.utcnow() - timedelta(minutes=30),
            ),
            LiveQuote(
                symbol="FAILED",
                ltp=None,
                updated_at=datetime.utcnow(),
            ),
        ]
    )
    db_session.commit()

    data = get_live_quotes(db_session)
    statuses = {q["symbol"]: q["status"] for q in data["quotes"]}

    assert statuses == {
        "FAILED": "failed",
        "FRESH": "fresh",
        "STALE": "stale",
    }
    assert data["status_counts"] == {"failed": 1, "fresh": 1, "stale": 1}
    assert data["stale_after_seconds"] == 900


def test_sync_live_quotes_reports_provider_status(monkeypatch, db_session):
    db_session.add(
        Trade(
            symbol="RELIANCE",
            direction="LONG",
            entry_price=Decimal("100.00"),
            quantity=Decimal("10"),
            entry_time=datetime.fromisoformat("2025-01-13T09:30:00"),
            status="open",
        )
    )
    db_session.commit()

    def fake_fetch(symbols):
        assert symbols == ["RELIANCE"]
        return [
            {
                "symbol": "RELIANCE",
                "company_name": "Reliance Industries",
                "ltp": Decimal("123.45"),
                "change": Decimal("1.20"),
                "change_pct": Decimal("0.98"),
                "volume": Decimal("1000"),
            }
        ], []

    monkeypatch.setattr("app.services.live_quote_sync.fetch_live_quotes", fake_fetch)

    data = sync_live_quotes(db_session)

    assert data["symbols"] == ["RELIANCE"]
    assert data["provider_status"] == "fresh"
    assert data["stale_after_seconds"] == 900
    assert data["upserted"] == 1

    quote = db_session.query(LiveQuote).filter(LiveQuote.symbol == "RELIANCE").one()
    assert quote.ltp == Decimal("123.4500")


def test_sync_live_quotes_reports_failed_provider(monkeypatch, db_session):
    db_session.add(
        Trade(
            symbol="RELIANCE",
            direction="LONG",
            entry_price=Decimal("100.00"),
            quantity=Decimal("10"),
            entry_time=datetime.fromisoformat("2025-01-13T09:30:00"),
            status="open",
        )
    )
    db_session.commit()

    monkeypatch.setattr("app.services.live_quote_sync.fetch_live_quotes", lambda symbols: ([], ["provider unavailable"]))

    data = sync_live_quotes(db_session)

    assert data["provider_status"] == "failed"
    assert data["upserted"] == 0
    assert data["errors"] == ["provider unavailable"]


def test_get_open_trade_symbols_excludes_closed_and_deleted(db_session):
    db_session.add_all(
        [
            Trade(
                symbol="RELIANCE",
                direction="LONG",
                entry_price=Decimal("100.00"),
                quantity=Decimal("10"),
                entry_time=datetime.fromisoformat("2025-01-13T09:30:00"),
                status="open",
            ),
            Trade(
                symbol="TCS",
                direction="LONG",
                entry_price=Decimal("100.00"),
                exit_price=Decimal("101.00"),
                quantity=Decimal("10"),
                entry_time=datetime.fromisoformat("2025-01-13T09:30:00"),
                status="closed",
            ),
            Trade(
                symbol="INFY",
                direction="LONG",
                entry_price=Decimal("100.00"),
                quantity=Decimal("10"),
                entry_time=datetime.fromisoformat("2025-01-13T09:30:00"),
                status="deleted",
            ),
        ]
    )
    db_session.commit()

    assert get_open_trade_symbols(db_session) == ["RELIANCE"]


def test_is_market_open_uses_india_hours():
    assert is_market_open(datetime.fromisoformat("2025-01-13T09:15:00+05:30")) is True
    assert is_market_open(datetime.fromisoformat("2025-01-13T15:30:00+05:30")) is True
    assert is_market_open(datetime.fromisoformat("2025-01-13T09:14:59+05:30")) is False
    assert is_market_open(datetime.fromisoformat("2025-01-13T15:30:01+05:30")) is False
    assert is_market_open(datetime.fromisoformat("2025-01-11T10:00:00+05:30")) is False


def test_fetch_live_quotes_uses_yfinance_only_for_missing_symbols(monkeypatch):
    def fake_nsetools(symbols):
        assert symbols == ["RELIANCE", "TCS"]
        return {
            "RELIANCE": {
                "symbol": "RELIANCE",
                "company_name": "Reliance Industries",
                "ltp": Decimal("100.00"),
                "change": Decimal("1.00"),
                "change_pct": Decimal("1.01"),
                "volume": Decimal("1000"),
            }
        }, {"TCS": "nsetools unavailable"}

    def fake_yfinance(symbols):
        assert symbols == ["TCS"]
        return {
            "TCS": {
                "symbol": "TCS",
                "company_name": "Tata Consultancy Services",
                "ltp": Decimal("200.00"),
                "change": Decimal("2.00"),
                "change_pct": Decimal("1.01"),
                "volume": Decimal("2000"),
            }
        }, {}

    monkeypatch.setattr(market_data_service, "_fetch_nsetools_quotes", fake_nsetools)
    monkeypatch.setattr(market_data_service, "_fetch_yfinance_quotes", fake_yfinance)

    quotes, errors = market_data_service.fetch_live_quotes(["RELIANCE", "TCS"])

    assert [quote["symbol"] for quote in quotes] == ["RELIANCE", "TCS"]
    assert errors == []
