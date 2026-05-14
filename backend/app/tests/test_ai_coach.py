"""Tests for the AI Coach service — isolated unit tests."""

import asyncio
import sys
import os
import unittest
from unittest.mock import AsyncMock, patch

_app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _app_dir not in sys.path:
    sys.path.insert(0, _app_dir)


class TestReviewCache(unittest.TestCase):
    """In-memory review cache with TTL."""

    def setUp(self):
        from services.ai_coach import ReviewCache
        self.cache = ReviewCache(ttl_seconds=3600)

    def test_miss_on_empty(self):
        self.assertIsNone(self.cache.get("nonexistent"))

    def test_hit_after_set(self):
        self.cache.set("k1", "hello")
        result = self.cache.get("k1")
        self.assertEqual(result, ("hello", 0))

    def test_clear(self):
        self.cache.set("a", "1")
        self.cache.set("b", "2")
        self.cache.clear()
        self.assertIsNone(self.cache.get("a"))
        self.assertIsNone(self.cache.get("b"))

    def test_len(self):
        self.cache.set("x", "1")
        self.cache.set("y", "2")
        self.assertEqual(len(self.cache), 2)

    @patch("time.time")
    def test_ttl_expiry(self, mock_time):
        mock_time.return_value = 1000
        self.cache.set("x", "val")
        mock_time.return_value = 4599  # within TTL (3599 < 3600)
        result = self.cache.get("x")
        self.assertEqual(result, ("val", 0))
        mock_time.return_value = 4601  # expired (3601 >= 3600)
        self.assertIsNone(self.cache.get("x"))

    def test_set_with_trades_count(self):
        """Verify trade count is stored and returned on cache hit."""
        self.cache.set("k1", "content", trades_analyzed=5)
        result = self.cache.get("k1")
        self.assertEqual(result, ("content", 5))


class TestReviewCacheKey(unittest.TestCase):
    """Cache key generation."""

    def test_deterministic(self):
        from services.ai_coach import review_cache_key
        k1 = review_cache_key("daily", "2026-01-01", "2026-01-02", "1,2,3")
        k2 = review_cache_key("daily", "2026-01-01", "2026-01-02", "1,2,3")
        self.assertEqual(k1, k2)

    def test_different_inputs(self):
        from services.ai_coach import review_cache_key
        k1 = review_cache_key("daily", "2026-01-01", "2026-01-02")
        k2 = review_cache_key("weekly", "2026-01-01", "2026-01-02")
        self.assertNotEqual(k1, k2)


class TestCoachTradeData(unittest.TestCase):
    """Trade formatting helper."""

    def test_format_single_trade(self):
        from services.ai_coach import _CoachTradeData
        trade = {
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": "2450.00",
            "exit_price": "2480.00",
            "quantity": "10",
            "pnl": "300.00",
            "setup": "EP",
        }
        result = _CoachTradeData.format_trade(trade)
        self.assertIn("RELIANCE", result)
        self.assertIn("LONG", result)
        self.assertIn("2450.00", result)

    def test_format_empty_trades(self):
        from services.ai_coach import _CoachTradeData
        self.assertEqual(
            _CoachTradeData.format_trades_summary([]),
            "No trades in this period.",
        )

    def test_format_multiple_trades(self):
        from services.ai_coach import _CoachTradeData
        trades = [
            {"symbol": "TCS", "direction": "LONG", "entry_price": "3500"},
            {"symbol": "INFY", "direction": "SHORT", "entry_price": "1500"},
        ]
        result = _CoachTradeData.format_trades_summary(trades)
        self.assertIn("TCS", result)
        self.assertIn("INFY", result)
        self.assertIn("--- Trade 1 ---", result)
        self.assertIn("--- Trade 2 ---", result)


class TestAICoachService(unittest.TestCase):
    """Service delegation to Ollama client."""

    def _make_coach(self):
        from services.ai_coach import AICoachService
        return AICoachService()

    def test_has_ollama_client(self):
        from services.ai_coach import AICoachService, OllamaClient
        coach = AICoachService()
        self.assertIsInstance(coach.client, OllamaClient)

    def test_daily_review_delegates(self):
        coach = self._make_coach()
        trades = [{"symbol": "RELIANCE", "direction": "LONG", "entry_price": "2450",
                    "exit_price": "2480", "quantity": "10", "pnl": "300"}]
        stats = {"total_trades": 1, "win_rate": "100%"}

        async def _run():
            with patch.object(coach.client, "chat",
                              new=AsyncMock(return_value="AI review text")):
                return await coach.generate_daily_review(trades, stats)

        result = asyncio.get_event_loop().run_until_complete(_run())
        self.assertEqual(result, "AI review text")

    def test_weekly_review_delegates(self):
        coach = self._make_coach()
        trades = [{"symbol": "TATA", "direction": "LONG", "entry_price": "700",
                    "exit_price": "720", "quantity": "5", "pnl": "100",
                    "entry_time": "2026-01-01T09:30:00"}]
        stats = {"total_trades": 1}
        setup_perf = {"Breakout": {"count": 1, "total_pnl": "100", "win_rate": "100%"}}

        async def _run():
            with patch.object(coach.client, "chat",
                              new=AsyncMock(return_value="Weekly review")):
                return await coach.generate_weekly_review(trades, stats, setup_perf)

        result = asyncio.get_event_loop().run_until_complete(_run())
        self.assertEqual(result, "Weekly review")

    def test_trade_insight_delegates(self):
        coach = self._make_coach()
        trades = [{"id": 1, "symbol": "INFY", "direction": "SHORT", "entry_price": "1500",
                    "exit_price": "1480", "quantity": "20", "pnl": "400", "setup": "Reversal",
                    "entry_time": "2026-01-01T10:00:00", "exit_time": "2026-01-01T14:00:00"}]

        async def _run():
            with patch.object(coach.client, "chat",
                              new=AsyncMock(return_value="Insight text")):
                return await coach.generate_trade_insight(trades, "Market was bearish")

        result = asyncio.get_event_loop().run_until_complete(_run())
        self.assertEqual(result, "Insight text")

    def test_ask_coach_delegates(self):
        coach = self._make_coach()

        async def _run():
            with patch.object(coach.client, "chat",
                              new=AsyncMock(return_value="Coach answer")):
                return await coach.ask_coach("What's my best setup?")

        result = asyncio.get_event_loop().run_until_complete(_run())
        self.assertEqual(result, "Coach answer")


class TestPydanticSchemas(unittest.TestCase):
    """Validate schema defaults and constraints."""

    def test_review_request_defaults(self):
        from schemas.coach import CoachReviewRequest
        req = CoachReviewRequest(trade_ids=[1, 2])
        self.assertEqual(req.trade_ids, [1, 2])
        self.assertIsNone(req.period_start)
        self.assertIsNone(req.context)

    def test_weekly_review_request_defaults(self):
        from schemas.coach import WeeklyReviewRequest
        req = WeeklyReviewRequest()
        self.assertIsNone(req.period_start)
        self.assertIsNone(req.period_end)

    def test_insight_request_requires_ids(self):
        from schemas.coach import TradeInsightRequest
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            TradeInsightRequest(context="test")  # trade_ids required

    def test_insight_request_ids_min_length(self):
        from schemas.coach import TradeInsightRequest
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            TradeInsightRequest(trade_ids=[])  # min_length=1

    def test_ask_coach_requires_question(self):
        from schemas.coach import AskCoachRequest
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            AskCoachRequest()  # question is required

    def test_review_response_fields(self):
        from schemas.coach import CoachReviewResponse
        resp = CoachReviewResponse(
            insight="test", review_type="daily",
            trades_analyzed=5, model_used="ollama",
            generated_at="2026-01-01T00:00:00",
        )
        self.assertEqual(resp.insight, "test")
        self.assertEqual(resp.trades_analyzed, 5)


class TestOllamaClient(unittest.TestCase):
    """Ollama client construction and API call shape."""

    def test_client_from_settings(self):
        from services.ai_coach import OllamaClient
        client = OllamaClient()
        self.assertIsInstance(client.base_url, str)
        self.assertIsInstance(client.model, str)
        self.assertGreater(client.timeout, 0)

    def test_chat_sends_correct_shape(self):
        from unittest.mock import MagicMock
        from services.ai_coach import OllamaClient

        client = OllamaClient()

        async def _run():
            # httpx.Response methods are sync — use MagicMock.
            mock_resp = MagicMock()
            mock_resp.raise_for_status = MagicMock()
            mock_resp.json = MagicMock(
                return_value={
                    "choices": [{"message": {"content": "OK"}}],
                    "usage": {"total_tokens": 100},
                }
            )

            # Mock the async client with __aenter__ that returns self
            class MockAsyncClient:
                async def __aenter__(self):
                    return self

                async def __aexit__(self, *args):
                    pass

                async def post(self, url, **kwargs):
                    return mock_resp

            with patch(
                "services.ai_coach.httpx.AsyncClient",
                return_value=MockAsyncClient(),
            ):
                messages = [{"role": "user", "content": "Hello"}]
                result = await client.chat(messages)
                return result

        result = asyncio.run(_run())
        self.assertEqual(result, "OK")


class TestPatternDetectionRequest(unittest.TestCase):
    """Validate new pattern detection schema."""

    def test_defaults(self):
        from schemas.coach import PatternDetectionRequest
        req = PatternDetectionRequest()
        self.assertEqual(req.lookback_days, 30)

    def test_lookback_range(self):
        from schemas.coach import PatternDetectionRequest
        from pydantic import ValidationError
        with self.assertRaises((ValidationError,)):
            PatternDetectionRequest(lookback_days=3)  # below min of 7

    def test_valid_custom_lookback(self):
        from schemas.coach import PatternDetectionRequest
        req = PatternDetectionRequest(lookback_days=90)
        self.assertEqual(req.lookback_days, 90)


class TestRuleReminderRequest(unittest.TestCase):
    """Validate new rule reminder schema."""

    def test_defaults(self):
        from schemas.coach import RuleReminderRequest
        req = RuleReminderRequest()
        self.assertEqual(req.lookback_days, 7)
        self.assertIsNone(req.rules)

    def test_custom_rules(self):
        from schemas.coach import RuleReminderRequest
        req = RuleReminderRequest(rules=["No FOMO", "Size properly"])
        self.assertEqual(req.rules, ["No FOMO", "Size properly"])


class TestDetectPatternsErrorSurfacing(unittest.TestCase):
    """verify detect_patterns raises on bad LLM output instead of []"""

    def test_no_json_lines_raises(self):
        from services.ai_coach import AICoachService
        from unittest.mock import AsyncMock, patch

        coach = AICoachService()
        trades = [{"symbol": "TEST", "direction": "LONG", "entry_price": "100"}]
        stats = {"total_trades": 1}

        async def _run():
            with patch.object(coach.client, "chat",
                              new=AsyncMock(return_value="No patterns here, just text.")):
                with self.assertRaises(ValueError) as ctx:
                    await coach.detect_patterns(trades, stats)
                self.assertIn("0 parseable patterns", str(ctx.exception))

        asyncio.run(_run())

    def test_only_bad_json_raises_with_details(self):
        from services.ai_coach import AICoachService
        from unittest.mock import AsyncMock, patch

        coach = AICoachService()
        trades = [{"symbol": "TEST", "direction": "LONG", "entry_price": "100"}]
        stats = {"total_trades": 1}

        async def _run():
            # Malformed JSON lines
            bad_output = '{"name": "broken'  # unclosed JSON
            with patch.object(coach.client, "chat",
                              new=AsyncMock(return_value=bad_output)):
                with self.assertRaises(ValueError) as ctx:
                    await coach.detect_patterns(trades, stats)
                self.assertIn("parseable patterns", str(ctx.exception))
                return True

        result = asyncio.run(_run())

    def test_valid_patterns_returned(self):
        from services.ai_coach import AICoachService
        import json as _json
        from unittest.mock import AsyncMock, patch

        coach = AICoachService()
        trades = [{"symbol": "TEST", "direction": "LONG", "entry_price": "100"}]
        stats = {"total_trades": 1}

        valid_line = _json.dumps({
            "name": "Test pattern",
            "severity": "positive",
            "description": "Works well",
            "evidence": "Evidence",
            "suggestion": None
        })

        async def _run():
            with patch.object(coach.client, "chat",
                              new=AsyncMock(return_value=valid_line)):
                result = await coach.detect_patterns(trades, stats)
                self.assertEqual(len(result), 1)
                self.assertEqual(result[0]["name"], "Test pattern")
                return result

        result = asyncio.run(_run())


class Test_read_prompt_raises(unittest.TestCase):
    """_read_prompt should raise on missing file, not return empty."""

    def test_missing_file_raises_error(self):
        from services.ai_coach import _read_prompt
        with self.assertRaises(FileNotFoundError) as ctx:
            _read_prompt("nonexistent_template.txt")
        self.assertIn("not found", str(ctx.exception).lower())


if __name__ == "__main__":
    unittest.main()
