import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from fastapi import status

from app.models.trade import Trade
from app.models.partial_exit import PartialExit
from app.models.market_candle import MarketCandle


@pytest.fixture
def auth_headers(client):
    resp = client.post("/api/v1/auth/register", json={
        "email": "chart@example.com",
        "full_name": "Chart User",
        "password": "testpass123",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_auth_headers(client):
    resp = client.post("/api/v1/auth/register", json={
        "email": "other2@example.com",
        "full_name": "Other User",
        "password": "testpass123",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_trade(db, user_id, **kwargs):
    defaults = {
        "user_id": user_id,
        "symbol": "RELIANCE",
        "direction": "LONG",
        "entry_price": Decimal("100.00"),
        "quantity": Decimal("10"),
        "entry_time": datetime(2024, 6, 15, 10, 0, 0),
        "fees": Decimal("0"),
        "status": "open",
    }
    defaults.update(kwargs)
    trade = Trade(**defaults)
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade


class TestChartDataEndpoint:
    def test_unauthorized_returns_401(self, client, db_session):
        resp = client.get("/api/v1/trades/1/chart-data")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_invalid_timeframe_returns_400(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?timeframe=2h",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_invalid_range_returns_400(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?range=3w",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_other_user_trade_returns_404(self, client, db_session, auth_headers, other_auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data",
            headers=other_auth_headers,
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_no_provider_returns_200_empty_candles(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["trade_id"] == trade.id
        assert data["symbol"] == "RELIANCE"
        assert isinstance(data["candles"], list)
        assert data["meta"]["has_real_data"] is False

    def test_annotations_include_entry_marker(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?source=cache",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert len(data["markers"]) >= 1
        entry_markers = [m for m in data["markers"] if m["shape"] == "arrowUp"]
        assert len(entry_markers) == 1
        assert entry_markers[0]["position"] == "belowBar"

    def test_closed_trade_has_exit_marker(self, client, db_session, auth_headers):
        trade = _create_trade(
            db_session, user_id=1,
            exit_price=Decimal("110.00"),
            exit_time=datetime(2024, 6, 15, 14, 0, 0),
            pnl=Decimal("100.00"),
            status="closed",
        )
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?source=cache",
            headers=auth_headers,
        )
        data = resp.json()
        exit_markers = [m for m in data["markers"] if m["shape"] == "arrowDown"]
        assert len(exit_markers) == 1

    def test_partial_exit_markers(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        pe = PartialExit(
            trade_id=trade.id,
            qty=Decimal("5"),
            exit_price=Decimal("105.00"),
            exit_time=datetime(2024, 6, 15, 12, 0, 0),
            realized_pnl=Decimal("25.00"),
        )
        db_session.add(pe)
        db_session.commit()

        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?source=cache",
            headers=auth_headers,
        )
        data = resp.json()
        partial_markers = [m for m in data["markers"] if m["shape"] == "circle"]
        assert len(partial_markers) == 1
        assert "Partial" in partial_markers[0]["text"]

    def test_stop_target_price_lines(self, client, db_session, auth_headers):
        trade = _create_trade(
            db_session, user_id=1,
            stop_price=Decimal("95.00"),
            target_price=Decimal("120.00"),
        )
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?source=cache",
            headers=auth_headers,
        )
        data = resp.json()
        assert len(data["price_lines"]) == 2
        stop_line = [pl for pl in data["price_lines"] if pl["title"] == "Stop"][0]
        assert stop_line["price"] == 95.0
        target_line = [pl for pl in data["price_lines"] if pl["title"] == "Target"][0]
        assert target_line["price"] == 120.0

    def test_mock_source_debug_mode(self, client, db_session, auth_headers, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "DEBUG", True)
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?source=mock",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["source"] == "mock"
        assert len(data["candles"]) > 0

    def test_mock_source_rejected_in_production(self, client, db_session, auth_headers, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "DEBUG", False)
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?source=mock",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["meta"]["has_real_data"] is False
        assert "DEBUG" in data["meta"]["message"]

    def test_candle_timestamps_are_unix_seconds(self, client, db_session, auth_headers, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "DEBUG", True)
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?source=mock",
            headers=auth_headers,
        )
        data = resp.json()
        for candle in data["candles"]:
            assert isinstance(candle["time"], int)
            assert candle["time"] > 1_700_000_000

    def test_cached_candles_returned(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        candle = MarketCandle(
            symbol="RELIANCE",
            timeframe="5m",
            timestamp=datetime(2024, 6, 15, 10, 0, 0),
            open=Decimal("100.00"),
            high=Decimal("101.00"),
            low=Decimal("99.50"),
            close=Decimal("100.50"),
            volume=50000,
            source="cache",
        )
        db_session.add(candle)
        db_session.commit()

        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?timeframe=5m&source=cache",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert len(data["candles"]) >= 1
        assert data["source"] == "cache"

    def test_default_timeframe_is_5m(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["timeframe"] == "5m"

    def test_default_range_is_auto(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["range"] == "auto"

    def test_invalid_source_returns_400(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?source=yfinance",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_mock_meta_includes_is_mock(self, client, db_session, auth_headers, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "DEBUG", True)
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?source=mock",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["meta"]["is_mock"] is True
        assert data["meta"]["has_real_data"] is False

    def test_non_mock_empty_data_is_not_mock(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?source=cache",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["meta"]["is_mock"] is False