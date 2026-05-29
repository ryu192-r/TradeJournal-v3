import pytest
from datetime import datetime
from decimal import Decimal
from unittest.mock import patch, MagicMock

from app.services.providers.tapetide_market_data import (
    TapetideNotConfigured,
    TapetideProviderError,
    fetch_price_history,
    build_tapetide_symbol,
    _parse_tapetide_response,
)


class TestTapetideNotConfigured:
    def test_missing_api_key_raises(self, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "TAPETIDE_ENABLED", False)
        monkeypatch.setattr(config.settings, "TAPETIDE_API_KEY", "")
        with pytest.raises(TapetideNotConfigured):
            fetch_price_history("RELIANCE", "1d", datetime(2024, 1, 1), datetime(2024, 1, 31))

    def test_enabled_but_no_key_raises(self, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "TAPETIDE_ENABLED", True)
        monkeypatch.setattr(config.settings, "TAPETIDE_API_KEY", "")
        with pytest.raises(TapetideNotConfigured):
            fetch_price_history("RELIANCE", "1d", datetime(2024, 1, 1), datetime(2024, 1, 31))


class TestTapetideUnsupportedTimeframe:
    def test_intraday_raises_value_error(self, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "TAPETIDE_ENABLED", True)
        monkeypatch.setattr(config.settings, "TAPETIDE_API_KEY", "test-key")
        with pytest.raises(ValueError, match="daily/weekly"):
            fetch_price_history("RELIANCE", "5m", datetime(2024, 1, 1), datetime(2024, 1, 31))

    def test_1h_raises_value_error(self, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "TAPETIDE_ENABLED", True)
        monkeypatch.setattr(config.settings, "TAPETIDE_API_KEY", "test-key")
        with pytest.raises(ValueError):
            fetch_price_history("RELIANCE", "1h", datetime(2024, 1, 1), datetime(2024, 1, 31))


class TestBuildTapetideSymbol:
    def test_plain_symbol_returned_as_is(self, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "TAPETIDE_DEFAULT_EXCHANGE", "NSE")
        assert build_tapetide_symbol("RELIANCE") == "RELIANCE"

    def test_colon_prefix_stripped(self, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "TAPETIDE_DEFAULT_EXCHANGE", "NSE")
        assert build_tapetide_symbol("NSE:RELIANCE") == "RELIANCE"

    def test_dot_suffix_stripped(self, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "TAPETIDE_DEFAULT_EXCHANGE", "NSE")
        assert build_tapetide_symbol("RELIANCE.NS") == "RELIANCE"

    def test_colon_and_dot_stripped(self, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "TAPETIDE_DEFAULT_EXCHANGE", "NSE")
        assert build_tapetide_symbol("NSE:RELIANCE.NS") == "RELIANCE"


class TestParseTapetideResponse:
    SAMPLE_DATA = [
        {"date": "2024-06-15", "open": 100.5, "high": 102.0, "low": 99.8, "close": 101.2, "volume": 50000},
        {"date": "2024-06-16", "open": 101.2, "high": 103.5, "low": 100.9, "close": 103.0, "volume": 60000},
    ]

    def test_parse_mcp_content_text(self):
        import json
        response = {
            "result": {
                "content": [
                    {"text": json.dumps({"data": self.SAMPLE_DATA})}
                ]
            }
        }
        candles = _parse_tapetide_response(response, "RELIANCE", "1d")
        assert len(candles) == 2
        assert candles[0]["symbol"] == "RELIANCE"
        assert candles[0]["timeframe"] == "1d"
        assert candles[0]["close"] == Decimal("101.2")
        assert candles[0]["source"] == "tapetide"
        assert candles[0]["timestamp"] == datetime(2024, 6, 15, 0, 0, 0)

    def test_parse_result_data_key(self):
        response = {
            "result": {
                "data": self.SAMPLE_DATA
            }
        }
        candles = _parse_tapetide_response(response, "TCS", "1d")
        assert len(candles) == 2
        assert candles[0]["symbol"] == "TCS"

    def test_parse_top_level_data(self):
        response = {"data": self.SAMPLE_DATA}
        candles = _parse_tapetide_response(response, "INFY", "1d")
        assert len(candles) == 2
        assert candles[0]["symbol"] == "INFY"

    def test_parse_result_prices_key(self):
        response = {
            "result": {
                "content": [
                    {"text": '{"prices": ' + str(self.SAMPLE_DATA).replace("'", '"') + '}'}
                ]
            }
        }
        candles = _parse_tapetide_response(response, "HDFCBANK", "1d")
        assert len(candles) == 2

    def test_unknown_format_raises(self):
        response = {"foo": "bar"}
        with pytest.raises(TapetideProviderError, match="unexpected response"):
            _parse_tapetide_response(response, "RELIANCE", "1d")

    def test_timestamp_date_only_is_start_of_day(self):
        response = {"data": [{"date": "2024-06-15", "open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 1000}]}
        candles = _parse_tapetide_response(response, "RELIANCE", "1d")
        assert candles[0]["timestamp"] == datetime(2024, 6, 15, 0, 0, 0)

    def test_volume_none_when_missing(self):
        response = {"data": [{"date": "2024-06-15", "open": 100, "high": 101, "low": 99, "close": 100.5}]}
        candles = _parse_tapetide_response(response, "RELIANCE", "1d")
        assert candles[0]["volume"] is None


class TestFetchPriceHistoryHttp:
    def test_successful_fetch(self, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config.settings, "TAPETIDE_ENABLED", True)
        monkeypatch.setattr(config.settings, "TAPETIDE_API_KEY", "test-key")
        monkeypatch.setattr(config.settings, "TAPETIDE_MCP_URL", "https://mcp.example.com/mcp")

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
            candles = fetch_price_history("RELIANCE", "1d", datetime(2024, 6, 1), datetime(2024, 6, 30))

        assert len(candles) == 1
        assert candles[0]["source"] == "tapetide"
        assert candles[0]["close"] == Decimal("100.5")

    def test_http_error_raises_provider_error(self, monkeypatch):
        from app.core import config
        import httpx
        monkeypatch.setattr(config.settings, "TAPETIDE_ENABLED", True)
        monkeypatch.setattr(config.settings, "TAPETIDE_API_KEY", "test-key")
        monkeypatch.setattr(config.settings, "TAPETIDE_MCP_URL", "https://mcp.example.com/mcp")

        with patch("app.services.providers.tapetide_market_data.httpx.post", side_effect=httpx.HTTPStatusError("500", request=MagicMock(), response=MagicMock())):
            with pytest.raises(TapetideProviderError):
                fetch_price_history("RELIANCE", "1d", datetime(2024, 6, 1), datetime(2024, 6, 30))

    def test_network_error_raises_provider_error(self, monkeypatch):
        from app.core import config
        import httpx
        monkeypatch.setattr(config.settings, "TAPETIDE_ENABLED", True)
        monkeypatch.setattr(config.settings, "TAPETIDE_API_KEY", "test-key")

        with patch("app.services.providers.tapetide_market_data.httpx.post", side_effect=httpx.RequestError("timeout")):
            with pytest.raises(TapetideProviderError):
                fetch_price_history("RELIANCE", "1d", datetime(2024, 6, 1), datetime(2024, 6, 30))

    def test_no_token_in_error_messages(self, monkeypatch):
        from app.core import config
        import httpx
        monkeypatch.setattr(config.settings, "TAPETIDE_ENABLED", True)
        monkeypatch.setattr(config.settings, "TAPETIDE_API_KEY", "super-secret-key-12345")

        with patch("app.services.providers.tapetide_market_data.httpx.post", side_effect=httpx.RequestError("timeout")):
            try:
                fetch_price_history("RELIANCE", "1d", datetime(2024, 6, 1), datetime(2024, 6, 30))
            except TapetideProviderError as e:
                assert "super-secret-key-12345" not in str(e)