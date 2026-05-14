"""Unit tests for AI Coach service helpers, cache, trade formatting.

Fast, deterministic — no AI provider needed.
"""

import time
import pytest

from app.services.ai_coach import (
    ReviewCache,
    review_cache_key,
    trade_to_dict,
    compute_summary_stats,
    compute_setup_performance,
    _CoachTradeData,
    AICoachService,
)


# ───────────────────── Fake AI client ─────────────────────

class _FakeClient:
    """Fake provider returning a configurable string."""
    def __init__(self, response: str = "Fake review"):
        self.response = response
        self.calls: list[dict] = []

    async def chat(self, messages: list[dict], temperature: float = 0.3, max_tokens: int = 2000) -> str:
        self.calls.append({"messages": messages, "temperature": temperature, "max_tokens": max_tokens})
        return self.response

    async def refresh(self) -> None:
        pass


# ───────────────────── Fake trade ─────────────────────

class _FT:
    """Minimal trade-like object for tests — any attribute works."""
    def __init__(self, **kw):
        for k, v in kw.items():
            setattr(self, k, v)


def _trade(
    id: int = 1, symbol: str = "RELIANCE", direction: str = "LONG",
    entry_price=2500, exit_price=2600, quantity=10, pnl=1000,
    setup: str = "Breakout", tactic: str = "ORB", stop_price=2480,
    target_price=None, r_multiple=2.5, notes: str = "",
    entry_time=None, exit_time=None,
) -> _FT:
    from datetime import datetime
    return _FT(
        id=id, symbol=symbol, direction=direction,
        entry_price=entry_price, exit_price=exit_price,
        quantity=quantity, pnl=pnl, setup=setup, tactic=tactic,
        stop_price=stop_price, target_price=target_price,
        r_multiple=r_multiple, notes=notes,
        entry_time=entry_time or datetime(2025, 1, 13, 9, 30),
        exit_time=exit_time or datetime(2025, 1, 13, 10, 0),
    )


# ───────────────────── ReviewCache ─────────────────────

def test_cache_set_get():
    cache = ReviewCache(ttl_seconds=3600)
    cache.set("key1", "review content", trades_analyzed=5)
    assert cache.get("key1") == ("review content", 5)


def test_cache_miss():
    cache = ReviewCache(ttl_seconds=3600)
    assert cache.get("nonexistent") is None


def test_cache_ttl_expiry():
    cache = ReviewCache(ttl_seconds=1)
    cache.set("key1", "review", 3)
    assert cache.get("key1") == ("review", 3)
    time.sleep(1.1)
    assert cache.get("key1") is None


def test_cache_clear():
    cache = ReviewCache(ttl_seconds=3600)
    cache.set("k1", "c1", 1)
    cache.set("k2", "c2", 2)
    assert len(cache) == 2
    cache.clear()
    assert len(cache) == 0


def test_cache_overwrite():
    cache = ReviewCache(ttl_seconds=3600)
    cache.set("key1", "old", 1)
    cache.set("key1", "new", 5)
    assert cache.get("key1") == ("new", 5)


# ───────────────────── review_cache_key ─────────────────────

def test_cache_key_deterministic():
    k1 = review_cache_key("daily", "2025-01-01", "2025-01-02")
    k2 = review_cache_key("daily", "2025-01-01", "2025-01-02")
    assert k1 == k2


def test_cache_key_different_types():
    k1 = review_cache_key("daily", "2025-01-01", "2025-01-02")
    k2 = review_cache_key("weekly", "2025-01-01", "2025-01-02")
    assert k1 != k2


def test_cache_key_different_trade_ids():
    k1 = review_cache_key("daily", "2025-01-01", "2025-01-02", "1,2,3")
    k2 = review_cache_key("daily", "2025-01-01", "2025-01-02", "4,5,6")
    assert k1 != k2


# ───────────────────── trade_to_dict ─────────────────────

def test_trade_to_dict_basic():
    t = _trade(id=1, symbol="TCS", direction="SHORT", pnl=-500, r_multiple=-1.0)
    d = trade_to_dict(t)
    assert d["id"] == 1
    assert d["symbol"] == "TCS"
    assert d["direction"] == "SHORT"
    assert d["pnl"] == "-500"


def test_trade_to_dict_null_values():
    t = _trade(exit_price=None, stop_price=None, r_multiple=None, notes=None)
    d = trade_to_dict(t)
    assert d["exit_price"] is None
    assert d["stop_price"] is None
    assert d["r_multiple"] is None
    assert d["notes"] is None


def test_trade_to_dict_serializes_decimals():
    from decimal import Decimal
    t = _trade(entry_price=Decimal("2500.50"), exit_price=Decimal("2600.75"))
    d = trade_to_dict(t)
    assert d["entry_price"] == "2500.50"
    assert d["exit_price"] == "2600.75"


# ───────────────────── compute_summary_stats ─────────────────────

def test_summary_stats_empty():
    assert compute_summary_stats([]) == {
        "total_trades": 0, "win_rate": "N/A",
        "total_pnl": "0.00", "avg_pnl": "0.00",
    }


def test_summary_stats_mixed():
    trades = [_trade(id=i, pnl=v) for i, v in [(1, 1000), (2, -500), (3, 750)]]
    stats = compute_summary_stats(trades)
    assert stats["total_trades"] == 3
    assert stats["wins"] == 2
    assert stats["losses"] == 1
    assert "win_rate" in stats


def test_summary_stats_all_wins():
    trades = [_trade(id=i, pnl=100) for i in range(1, 6)]
    stats = compute_summary_stats(trades)
    assert stats["wins"] == 5
    assert stats["losses"] == 0
    assert stats["win_rate"] == "100.0%"


# ───────────────────── compute_setup_performance ─────────────────────

def test_setup_performance_single():
    trades = [_trade(id=1, setup="Breakout", pnl=500)]
    result = compute_setup_performance(trades)
    assert "Breakout" in result
    assert result["Breakout"]["count"] == 1


def test_setup_performance_multiple():
    trades = [
        _trade(id=1, setup="Breakout", pnl=500),
        _trade(id=2, setup="Pullback", pnl=-200),
        _trade(id=3, setup="Breakout", pnl=300),
    ]
    result = compute_setup_performance(trades)
    assert "Breakout" in result
    assert "Pullback" in result
    assert result["Breakout"]["count"] == 2


def test_setup_performance_null_setup():
    trades = [_trade(id=1, setup=None, pnl=100)]
    result = compute_setup_performance(trades)
    assert "Uncategorized" in result
    assert result["Uncategorized"]["count"] == 1


# ───────────────────── _CoachTradeData ─────────────────────

def test_format_trade():
    output = _CoachTradeData.format_trade({"symbol": "RELIANCE", "direction": "LONG"})
    assert "Symbol: RELIANCE" in output
    assert "Direction: LONG" in output


def test_format_trade_with_notes():
    output = _CoachTradeData.format_trade({"symbol": "TCS", "notes": "Good setup"})
    assert "Notes: Good setup" in output


def test_format_trades_summary_empty():
    assert _CoachTradeData.format_trades_summary([]) == "No trades in this period."


def test_format_trades_summary_multi():
    output = _CoachTradeData.format_trades_summary([{"symbol": "A"}, {"symbol": "B"}])
    assert "--- Trade 1 ---" in output
    assert "--- Trade 2 ---" in output


# ───────────────────── AICoachService (injection) ─────────────────────

@pytest.mark.asyncio
async def test_ai_coach_inject_fake():
    fake = _FakeClient("Mocked daily review")
    service = AICoachService(client=fake)
    trades = [_trade(id=1)]
    result = await service.generate_daily_review(
        trades=[trade_to_dict(t) for t in trades],
        summary_stats=compute_summary_stats(trades),
    )
    assert result == "Mocked daily review"
    assert len(fake.calls) == 1
    assert fake.calls[0]["messages"][1]["content"].startswith("TODAY'S TRADES:")


@pytest.mark.asyncio
async def test_ai_coach_detect_patterns_parsing():
    fake = _FakeClient(
        '{"name": "Pattern A", "severity": "positive", "description": "Good", "evidence": "Win rate high", "suggestion": null}'
        '\n{"name": "Pattern B", "severity": "negative", "description": "Bad", "evidence": "Losses cluster", "suggestion": "Fix it"}'
    )
    service = AICoachService(client=fake)
    result = await service.detect_patterns(
        trades=[trade_to_dict(_trade(id=1))],
        summary_stats={"total_trades": 1},
        lookback_days=7,
    )
    assert len(result) == 2
    assert result[0]["name"] == "Pattern A"
    assert result[1]["severity"] == "negative"


@pytest.mark.asyncio
async def test_ai_coach_detect_patterns_invalid_json():
    fake = _FakeClient("This is not JSON at all!")
    service = AICoachService(client=fake)
    with pytest.raises(ValueError, match="0 parseable patterns"):
        await service.detect_patterns(
            trades=[trade_to_dict(_trade(id=1))],
            summary_stats={"total_trades": 1},
        )


@pytest.mark.asyncio
async def test_ai_coach_refresh_swap():
    fake1 = _FakeClient("old")
    service = AICoachService(client=fake1)
    assert await service.generate_daily_review(
        trades=[trade_to_dict(_trade(id=1))],
        summary_stats=compute_summary_stats([_trade(id=1)]),
    ) == "old"
    fake2 = _FakeClient("new")
    service._client = fake2
    assert await service.generate_daily_review(
        trades=[trade_to_dict(_trade(id=1))],
        summary_stats=compute_summary_stats([_trade(id=1)]),
    ) == "new"


@pytest.mark.asyncio
async def test_ai_coach_rule_reminder():
    fake = _FakeClient("All rules compliant!")
    service = AICoachService(client=fake)
    result = await service.check_rule_reminders(
        trades=[trade_to_dict(_trade(id=1))],
        rules=None,
    )
    assert result == "All rules compliant!"
    assert fake.calls[0]["max_tokens"] == 1000
