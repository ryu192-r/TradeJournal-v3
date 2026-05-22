"""Tests for trade calculation utilities — P&L, R-multiple, risk/reward, streaks, KPIs."""

from decimal import Decimal
import pytest
from app.utils.calculations import (
    calculate_trade_metrics,
    compute_pnl_value,
    compute_r_multiple,
    compute_live_pnl,
    compute_aggregate_kpis,
)


# ─────────────────────── calculate_trade_metrics ───────────────────────


class TestLongWinningTrade:
    """Entry=100, Exit=110, Qty=100, Stop=95, Target=120"""

    def test_net_pnl(self):
        result = calculate_trade_metrics(
            entry_price=100,
            exit_price=110,
            quantity=100,
            stop_price=95,
            target_price=120,
        )
        assert result.net_pnl == Decimal("1000")

    def test_r_multiple(self):
        result = calculate_trade_metrics(
            entry_price=100,
            exit_price=110,
            quantity=100,
            stop_price=95,
            target_price=120,
        )
        # risk_amount = (100-95)*100 = 500, net_pnl=1000, r = 1000/500 = 2.0
        assert result.r_multiple == Decimal("2")

    def test_risk_reward_ratio(self):
        result = calculate_trade_metrics(
            entry_price=100,
            exit_price=110,
            quantity=100,
            stop_price=95,
            target_price=120,
        )
        # risk_per_unit = 5, reward_per_unit = 20, ratio = 20/5 = 4.0
        assert result.risk_reward_ratio == Decimal("4")

    def test_is_valid(self):
        result = calculate_trade_metrics(
            entry_price=100,
            exit_price=110,
            quantity=100,
            stop_price=95,
            target_price=120,
        )
        assert result.is_valid_for_pnl is True
        assert result.is_valid_for_risk_reward is True


class TestLongLosingTrade:
    """Entry=100, Exit=90, Qty=50, Stop=95, Target=120"""

    def test_negative_pnl(self):
        result = calculate_trade_metrics(entry_price=100, exit_price=90, quantity=50, stop_price=95, target_price=120)
        assert result.net_pnl == Decimal("-500")

    def test_negative_r_multiple(self):
        result = calculate_trade_metrics(entry_price=100, exit_price=90, quantity=50, stop_price=95, target_price=120)
        # risk_amount = (100-95)*50 = 250, net_pnl=-500, r = -500/250 = -2.0
        assert result.r_multiple == Decimal("-2")

    def test_risk_reward_unchanged(self):
        result = calculate_trade_metrics(entry_price=100, exit_price=90, quantity=50, stop_price=95, target_price=120)
        assert result.risk_reward_ratio == Decimal("4")  # still 20/5 = 4 planned


class TestShortWinningTrade:
    """Entry=200, Exit=190, Qty=100, Stop=210, Target=180, direction=SHORT"""

    def test_net_pnl_short(self):
        result = calculate_trade_metrics(
            entry_price=200, exit_price=190, quantity=100,
            stop_price=210, target_price=180, direction="SHORT",
        )
        assert result.net_pnl == Decimal("1000")  # (200-190)*100 = 1000

    def test_r_multiple_short(self):
        result = calculate_trade_metrics(
            entry_price=200, exit_price=190, quantity=100,
            stop_price=210, target_price=180, direction="SHORT",
        )
        # risk_per_unit = 210-200 = 10, risk_amount = 10*100 = 1000
        # r_multiple = 1000/1000 = 1.0
        assert result.r_multiple == Decimal("1")


class TestShortLosingTrade:
    """Entry=200, Exit=215, Qty=50, Stop=210, Target=180"""

    def test_negative_pnl_short(self):
        result = calculate_trade_metrics(
            entry_price=200, exit_price=215, quantity=50,
            stop_price=210, target_price=180, direction="SHORT",
        )
        assert result.net_pnl == Decimal("-750")  # (200-215)*50 = -750

    def test_negative_r_short(self):
        result = calculate_trade_metrics(
            entry_price=200, exit_price=215, quantity=50,
            stop_price=210, target_price=180, direction="SHORT",
        )
        # risk_amount = (210-200)*50 = 500, r = -750/500 = -1.5
        assert result.r_multiple == Decimal("-1.5")


# ── Edge cases ──


class TestMissingStopLoss:
    def test_no_r_multiple(self):
        result = calculate_trade_metrics(entry_price=100, exit_price=110, quantity=100)
        assert result.net_pnl == Decimal("1000")
        assert result.r_multiple is None
        assert result.is_valid_for_pnl is True
        assert result.is_valid_for_risk_reward is False

    def test_no_risk_warnings(self):
        result = calculate_trade_metrics(entry_price=100, exit_price=110, quantity=100)
        assert not any("entry_price" in w.lower() for w in result.warnings)


class TestMissingTarget:
    def test_no_risk_reward(self):
        result = calculate_trade_metrics(entry_price=100, exit_price=110, quantity=100, stop_price=95)
        assert result.risk_reward_ratio is None
        assert result.is_valid_for_risk_reward is False
        assert result.r_multiple is not None  # R requires only stop, not target


class TestMissingExitPrice:
    def test_no_pnl(self):
        result = calculate_trade_metrics(entry_price=100, quantity=100, stop_price=95, target_price=120)
        assert result.net_pnl is None
        assert result.r_multiple is None
        assert result.is_valid_for_pnl is False
        assert result.is_valid_for_risk_reward is True  # risk:reward does NOT need exit


class TestZeroQuantity:
    def test_returns_null(self):
        result = calculate_trade_metrics(entry_price=100, exit_price=110, quantity=0)
        assert result.net_pnl is None
        assert result.r_multiple is None
        assert any("quantity" in w.lower() for w in result.warnings)


class TestZeroRisk:
    def test_no_r_and_no_ratio(self):
        result = calculate_trade_metrics(entry_price=100, exit_price=110, quantity=100, stop_price=100)
        assert result.r_multiple is None
        assert result.risk_reward_ratio is None
        assert any("risk" in w.lower() for w in result.warnings)


class TestMissingEntry:
    def test_returns_early(self):
        result = calculate_trade_metrics(entry_price=None, exit_price=110, quantity=100)
        assert result.net_pnl is None
        assert result.r_multiple is None
        assert any("entry_price" in w.lower() for w in result.warnings)


class TestWithFees:
    def test_net_pnl_deducts_fees(self):
        result = calculate_trade_metrics(entry_price=100, exit_price=110, quantity=100, fees=50, stop_price=95)
        assert result.net_pnl == Decimal("950")  # 1000 - 50
        # risk_amount=500, r = 950/500 = 1.9
        assert result.r_multiple == Decimal("1.9")


# ── Smoke: ensure no exceptions for any combos ──


class TestGracefulDegradation:
    def test_all_none(self):
        result = calculate_trade_metrics()
        assert result.net_pnl is None
        assert result.r_multiple is None

    def test_invalid_strings(self):
        result = calculate_trade_metrics(entry_price="abc", exit_price="def", quantity="ghi")
        assert result.net_pnl is None

    def test_negative_entry(self):
        result = calculate_trade_metrics(entry_price=-100, exit_price=110, quantity=10)
        assert result.net_pnl is None
        assert any("entry_price" in w.lower() for w in result.warnings)


# ─────────────────────── compute_pnl_value ───────────────────────


class TestComputePnlValue:
    def test_normal(self):
        assert compute_pnl_value(100, 110, 100, 0) == Decimal("1000")

    def test_with_fees(self):
        assert compute_pnl_value(100, 110, 100, 50) == Decimal("950")

    def test_missing_exit(self):
        assert compute_pnl_value(100, None, 100) is None

    def test_bad_inputs(self):
        assert compute_pnl_value(None, 110, 100) is None
        assert compute_pnl_value(100, 110, 0) is None


# ─────────────────────── compute_r_multiple ───────────────────────


class TestComputeRMultiple:
    def test_normal(self):
        assert compute_r_multiple(1000, 500) == Decimal("2")

    def test_zero_risk(self):
        assert compute_r_multiple(1000, 0) is None

    def test_none_risk(self):
        assert compute_r_multiple(1000, None) is None


# ─────────────────────── compute_live_pnl ───────────────────────


class TestComputeLivePnl:
    def test_long_profit(self):
        result = compute_live_pnl(entry_price=100, ltp=110, quantity=100)
        assert result == Decimal("1000")

    def test_long_with_partial_remaining(self):
        result = compute_live_pnl(entry_price=100, ltp=110, quantity=100, remaining_qty=50, fees=20)
        # pnl_per_unit=10, rem=50, gross=500, fee_ratio=50/100=0.5, fees*ratio=10, net=490
        assert result == Decimal("490")

    def test_no_ltp(self):
        result = compute_live_pnl(entry_price=100, ltp=None, quantity=100)
        assert result is None


# ─────────────────────── compute_aggregate_kpis ───────────────────────


class TestComputeAggregateKpis:
    def test_empty(self):
        result = compute_aggregate_kpis([])
        assert result["trade_count"] == 0
        assert result["net_pnl"] is None

    def test_single_win(self):
        class Fake:
            pass
        t = Fake()
        t.pnl = Decimal("1000")
        t.r_multiple = Decimal("2")
        result = compute_aggregate_kpis([t])
        assert result["trade_count"] == 1
        assert result["win_rate"] == 100.0
        assert result["avg_r"] == 2.0

    def test_win_and_loss(self):
        class Fake:
            pass
        w = Fake()
        w.pnl = Decimal("200")
        w.r_multiple = Decimal("2")
        l = Fake()
        l.pnl = Decimal("-100")
        l.r_multiple = Decimal("-1")
        result = compute_aggregate_kpis([w, l])
        assert result["trade_count"] == 2
        assert result["net_pnl"] == 100.0
        assert result["win_rate"] == 50.0
        assert result["profit_factor"] == 2.0
        assert result["avg_r"] == 0.5
