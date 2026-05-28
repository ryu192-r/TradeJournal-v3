"""Tests for import normalization helpers."""
import pytest
from decimal import Decimal
from datetime import datetime

from app.services.import_normalization import (
    normalize_symbol,
    normalize_direction,
    parse_decimal,
    parse_datetime,
    normalize_import_row,
)


class TestNormalizeSymbol:
    def test_upper_and_trim(self):
        assert normalize_symbol(" reliance ") == "RELIANCE"

    def test_remove_exchange_prefix(self):
        assert normalize_symbol("NSE:reliance") == "RELIANCE"

    def test_keep_fno_suffix(self):
        assert normalize_symbol("NIFTY25500CE") == "NIFTY25500CE"

    def test_reject_blank(self):
        with pytest.raises(ValueError, match="blank"):
            normalize_symbol("")

    def test_reject_none(self):
        with pytest.raises(ValueError, match="blank"):
            normalize_symbol(None)


class TestNormalizeDirection:
    def test_buy(self):
        assert normalize_direction("BUY") == "LONG"

    def test_long(self):
        assert normalize_direction("LONG") == "LONG"

    def test_sell_raises(self):
        with pytest.raises(ValueError, match="not supported"):
            normalize_direction("SELL")

    def test_short_raises(self):
        with pytest.raises(ValueError, match="not supported"):
            normalize_direction("SHORT")

    def test_unknown_raises(self):
        with pytest.raises(ValueError, match="Unknown"):
            normalize_direction("HOLD")

    def test_none_defaults_long(self):
        assert normalize_direction(None) == "LONG"


class TestParseDecimal:
    def test_comma_number(self):
        assert parse_decimal("1,250.50", "entry_price") == Decimal("1250.50")

    def test_blank_returns_none(self):
        assert parse_decimal("", "fees") is None

    def test_invalid_raises(self):
        with pytest.raises(ValueError, match="not a valid"):
            parse_decimal("abc", "entry_price")

    def test_zero_entry_price_rejected(self):
        with pytest.raises(ValueError, match="must be > 0"):
            parse_decimal("0", "entry_price")

    def test_negative_entry_price_rejected(self):
        with pytest.raises(ValueError, match="must be > 0"):
            parse_decimal("-10", "entry_price")

    def test_zero_quantity_rejected(self):
        with pytest.raises(ValueError, match="must be > 0"):
            parse_decimal("0", "quantity")

    def test_negative_fees_rejected(self):
        with pytest.raises(ValueError, match="must be >= 0"):
            parse_decimal("-1", "fees")


class TestParseDatetime:
    def test_iso_utc_converts_ist(self):
        dt = parse_datetime("2024-01-15T09:20:00Z")
        # UTC -> IST = +5:30
        assert dt.hour == 14 or dt.hour == 15  # depending on DST
        assert dt.tzinfo is None

    def test_naive_ist_preserved(self):
        dt = parse_datetime("2024-01-15 09:20:00")
        assert dt.year == 2024
        assert dt.month == 1
        assert dt.day == 15
        assert dt.hour == 9
        assert dt.tzinfo is None

    def test_dmy_date(self):
        dt = parse_datetime("15/01/2024 09:20:00")
        assert dt.day == 15
        assert dt.month == 1

    def test_unparseable_raises(self):
        with pytest.raises(ValueError, match="unparseable"):
            parse_datetime("not-a-date")

    def test_default_to_now(self):
        dt = parse_datetime(None, default_to_now=True)
        assert dt is not None
        assert dt.tzinfo is None


class TestNormalizeImportRow:
    def test_valid_closed_trade(self):
        row = {
            "symbol": "RELIANCE",
            "direction": "BUY",
            "entry_price": "100",
            "quantity": "10",
            "entry_time": "2024-01-15 09:20:00",
            "exit_price": "110",
            "exit_time": "2024-01-15 14:30:00",
            "fees": "5",
        }
        out = normalize_import_row(row)
        assert out["symbol"] == "RELIANCE"
        assert out["entry_price"] == Decimal("100")
        assert out["exit_price"] == Decimal("110")
        assert out["fees"] == Decimal("5")

    def test_missing_entry_price_raises(self):
        row = {"symbol": "RELIANCE", "quantity": "10", "entry_time": "2024-01-15"}
        with pytest.raises(ValueError, match="entry_price"):
            normalize_import_row(row)

    def test_exit_without_exit_time_raises(self):
        row = {
            "symbol": "RELIANCE", "entry_price": "100", "quantity": "10",
            "entry_time": "2024-01-15", "exit_price": "110",
        }
        with pytest.raises(ValueError, match="exit_time"):
            normalize_import_row(row)

    def test_exit_before_entry_raises(self):
        row = {
            "symbol": "RELIANCE", "entry_price": "100", "quantity": "10",
            "entry_time": "2024-01-15 14:00:00",
            "exit_price": "110", "exit_time": "2024-01-15 09:00:00",
        }
        with pytest.raises(ValueError, match="before"):
            normalize_import_row(row)
