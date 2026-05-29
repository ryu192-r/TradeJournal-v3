import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock
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

    def test_default_timeframe_is_1d(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["timeframe"] == "1d"

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

    def test_tapetide_source_with_unsupported_timeframe_returns_message(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?timeframe=5m&source=tapetide",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["meta"]["has_real_data"] is False
        assert "daily" in data["meta"]["message"].lower()

    def test_tapetide_source_not_configured_returns_message(self, client, db_session, auth_headers, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "TAPETIDE_ENABLED", False)
        monkeypatch.setattr(config.settings, "TAPETIDE_API_KEY", "")
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?timeframe=1d&source=tapetide",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["meta"]["has_real_data"] is False
        assert "not configured" in data["meta"]["message"].lower() or "TAPETIDE_API_KEY" in data["meta"]["message"]

    def test_cache_source_never_calls_tapetide(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?timeframe=1d&source=cache",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["source"] == "cache"

    def test_auto_source_with_daily_timeframe_uses_tapetide_on_no_cache(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?timeframe=1d&source=auto",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        # With TAPETIDE_ENABLED=False, falls through to no-data
        data = resp.json()
        assert data["meta"]["has_real_data"] is False

    def test_deleted_trade_returns_404(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        trade_id = trade.id
        db_session.delete(trade)
        db_session.commit()
        resp = client.get(
            f"/api/v1/trades/{trade_id}/chart-data",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_tapetide_valid_source(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?source=tapetide&timeframe=1d",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK

    def test_1w_timeframe_valid(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?timeframe=1w",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK

    def test_tapetide_mocked_candles_cached_and_returned(self, client, db_session, auth_headers, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "TAPETIDE_ENABLED", True)
        monkeypatch.setattr(config.settings, "TAPETIDE_API_KEY", "test-key")
        monkeypatch.setattr(config.settings, "TAPETIDE_MCP_URL", "https://mcp.test.com/mcp")

        trade = _create_trade(db_session, user_id=1)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "result": {
                "data": [
                    {"date": "2024-06-15", "open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 5000},
                ]
            }
        }

        with patch("app.services.providers.tapetide_market_data.httpx.post", return_value=mock_response):
            resp = client.get(
                f"/api/v1/trades/{trade.id}/chart-data?timeframe=1d&source=tapetide",
                headers=auth_headers,
            )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["source"] == "tapetide"
        assert len(data["candles"]) >= 1

        # Second request should use cached data
        resp2 = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?timeframe=1d&source=cache",
            headers=auth_headers,
        )
        assert resp2.status_code == status.HTTP_200_OK
        assert len(resp2.json()["candles"]) >= 1

    def test_auto_daily_does_not_call_dhan(self, client, db_session, auth_headers):
        trade = _create_trade(db_session, user_id=1)
        # source=auto with timeframe=1d should not attempt Dhan (intraday-only provider)
        # With TAPETIDE_ENABLED=False, returns empty — no crash
        resp = client.get(
            f"/api/v1/trades/{trade.id}/chart-data?timeframe=1d&source=auto",
            headers=auth_headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["meta"]["has_real_data"] is False