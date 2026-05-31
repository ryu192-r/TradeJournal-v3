"""AI Coach service — multi-provider AI integration for trading insights.

Supports Ollama, OpenAI, DeepSeek, Anthropic, and Google Gemini providers.
Configuration is loaded at runtime from ``ai_config.json`` with fallback
to environment variables.
"""

import asyncio
import hashlib
import json
import re
import structlog
import time
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.ai_config import get_ai_config
from app.core.ai_provider_client import AIProviderClient
from app.utils.logging import get_logger

logger = get_logger(__name__)

# ──────────────────────── Prompt Template Loader ────────────────────────

_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def _read_prompt(filename: str) -> str:
    """Read a prompt template from the prompts/ directory."""
    path = _PROMPTS_DIR / filename
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    raise FileNotFoundError(
        f"Prompt template '{filename}' not found at {path}. "
        f"Ensure the prompts/ directory contains all required templates."
    )


# Load prompt templates from files at boot time — boot will fail fast if any are missing
DAILY_REVIEW_SYSTEM = _read_prompt("daily_review.txt")
WEEKLY_REVIEW_SYSTEM = _read_prompt("weekly_review.txt")
TRADE_INSIGHT_SYSTEM = _read_prompt("trade_insight.txt")
ASK_COACH_SYSTEM = _read_prompt("ask_coach.txt")
RULE_REMINDER_SYSTEM = _read_prompt("rule_reminder.txt")
TRADE_REVIEW_SYSTEM = _read_prompt("trade_review.txt")


# ──────────────────────── Back-compat aliases ────────────────────────


class _LegacyClientWrapper:
    """Back-compat wrapper so old ``OllamaClient()`` calls keep working.

    Reads config at runtime (or on ``refresh()``) instead of boot time.
    """

    def __init__(self) -> None:
        cfg = get_ai_config()
        self._client = AIProviderClient(cfg)

    @property
    def base_url(self) -> str:
        return self._client.base_url

    @property
    def api_key(self) -> str:
        return self._client.api_key

    @property
    def model(self) -> str:
        return self._client.model

    @property
    def timeout(self) -> float:
        return self._client.timeout

    @property
    def max_attempts(self) -> int:
        return self._client.max_retries

    async def chat(
        self,
        messages: list[dict],
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> str:
        return await self._client.chat(messages, temperature, max_tokens)

    async def refresh(self) -> None:
        await self._client.refresh()


OllamaClient = _LegacyClientWrapper


# ──────────────────────── AI Coach Service ────────────────────────


class AICoachService:
    """Service for generating AI-powered trading insights."""

    def __init__(self, client: Optional[AIProviderClient] = None, cfg: Optional[dict] = None) -> None:
        self._client: AIProviderClient
        self._config = cfg or get_ai_config()
        if client is not None:
            self._client = client
        else:
            self._client = AIProviderClient(self._config)

    @property
    def client(self) -> AIProviderClient:
        return self._client

    async def refresh(self, cfg: Optional[dict] = None) -> None:
        """Reload the provider config from disk and re-use it."""
        self._config = cfg or get_ai_config()
        self._client = AIProviderClient(self._config)
        logger.info("ai_coach_service_refreshed")

    async def _chat(
        self,
        messages: list[dict],
        max_tokens: int = 2000,
    ) -> str:
        """Internal helper that reads temperature from config."""
        return await self._client.chat(
            messages,
            temperature=self._config.get("temperature", 0.3),
            max_tokens=max_tokens,
        )

    async def generate_daily_review(
        self,
        trades: List[dict],
        summary_stats: dict,
    ) -> str:
        """Generate end-of-day review from today's trades."""
        trade_text = _CoachTradeData.format_trades_summary(trades)
        stats_text = "\n".join(f"- {k}: {v}" for k, v in summary_stats.items())

        user_prompt = f"TODAY'S TRADES:\n{trade_text}\n\nSUMMARY STATS:\n{stats_text}"

        logger.info("generating_daily_review", trade_count=len(trades))
        messages = [
            {"role": "system", "content": DAILY_REVIEW_SYSTEM},
            {"role": "user", "content": user_prompt},
        ]
        return await self._chat(messages, max_tokens=2000)

    async def generate_weekly_review(
        self,
        trades: List[dict],
        summary_stats: dict,
        setup_performance: dict,
    ) -> str:
        """Generate weekly performance review."""
        trade_text = _CoachTradeData.format_trades_summary(trades)
        stats_text = "\n".join(f"- {k}: {v}" for k, v in summary_stats.items())

        setup_lines = []
        for setup, stats in setup_performance.items():
            setup_lines.append(
                f"- {setup}: count={stats.get('count', '?')}, "
                f"pnl={stats.get('total_pnl', 'N/A')}, "
                f"win_rate={stats.get('win_rate', 'N/A')}"
            )
        setup_text = "\n".join(setup_lines) if setup_lines else "No setup breakdown available"

        user_prompt = (
            f"WEEK'S TRADES:\n{trade_text}\n\n"
            f"SUMMARY STATS:\n{stats_text}\n\n"
            f"SETUP PERFORMANCE:\n{setup_text}"
        )

        logger.info("generating_weekly_review", trade_count=len(trades))
        messages = [
            {"role": "system", "content": WEEKLY_REVIEW_SYSTEM},
            {"role": "user", "content": user_prompt},
        ]
        return await self._chat(messages, max_tokens=3000)

    async def generate_trade_insight(
        self,
        trades: List[dict],
        context: str = "",
    ) -> str:
        """Generate analysis for specific trades."""
        trade_text = _CoachTradeData.format_trades_summary(trades)
        context_text = context if context else "No additional context."

        user_prompt = f"TRADES TO ANALYZE:\n{trade_text}\n\nCONTEXT:\n{context_text}"

        logger.info("generating_trade_insight", trade_count=len(trades))
        messages = [
            {"role": "system", "content": TRADE_INSIGHT_SYSTEM},
            {"role": "user", "content": user_prompt},
        ]
        return await self._chat(messages, max_tokens=3000)

    async def ask_coach(
        self,
        question: str,
        trade_data: Optional[List[dict]] = None,
        summary_stats: Optional[dict] = None,
    ) -> str:
        """Free-form Q&A — 'Ask the Coach' feature."""
        context_parts = [f"QUESTION:\n{question}"]
        if trade_data:
            context_parts.append(
                f"RELEVANT TRADES:\n{_CoachTradeData.format_trades_summary(trade_data)}"
            )
        if summary_stats:
            context_parts.append(
                f"STATISTICS:\n" + "\n".join(f"- {k}: {v}" for k, v in summary_stats.items())
            )

        user_prompt = "\n\n".join(context_parts)

        logger.info("coach_question", question_preview=question[:80])
        messages = [
            {"role": "system", "content": ASK_COACH_SYSTEM},
            {"role": "user", "content": user_prompt},
        ]
        return await self._chat(messages, max_tokens=2000)

    async def detect_patterns(
        self,
        trades: List[dict],
        summary_stats: dict,
        lookback_days: int = 30,
    ) -> List[dict]:
        """Detect recurring behavioral and performance patterns in trades."""
        trade_text = _CoachTradeData.format_trades_summary(trades)
        stats_text = "\n".join(f"- {k}: {v}" for k, v in summary_stats.items())

        user_prompt = (
            f"TRADES (last {lookback_days} days):\n{trade_text}\n\n"
            f"SUMMARY STATS:\n{stats_text}\n\n"
            "Identify 3-5 recurring patterns. For each, return JSON on one line:\n"
            '{"name": "...", "severity": "positive|negative|neutral", '
            '"description": "...", "evidence": "...", "suggestion": "..."}\n'
            "Do NOT include markdown fences. Only output the JSON lines."
        )

        logger.info("detecting_patterns", trade_count=len(trades), lookback_days=lookback_days)
        messages = [
            {"role": "system", "content": TRADE_INSIGHT_SYSTEM},
            {"role": "user", "content": user_prompt},
        ]
        raw = await self._chat(messages, max_tokens=2000)

        patterns: List[dict] = []
        parse_errors: List[str] = []

        for line in raw.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            line = re.sub(r'^```(?:json)?\s*$', '', line).strip()
            line = re.sub(r'^```\s*$', '', line).strip()
            if not line.startswith("{"):
                continue
            try:
                parsed = json.loads(line)
                patterns.append(parsed)
            except json.JSONDecodeError as exc:
                parse_errors.append(f"Line: {line!r}, Error: {exc}")

        if not patterns:
            raise ValueError(
                f"LLM returned {len(raw)} bytes but 0 parseable patterns. "
                f"Parse errors: {'; '.join(parse_errors) if parse_errors else 'no JSON lines found'}. "
                f"Raw output preview: {raw[:200]!r}"
            )

        return patterns

    async def generate_trade_review(self, trade_dict: dict) -> dict:
        """Generate a structured post-trade review for a single trade.

        Returns a dict matching the TradeReviewResponse schema.
        """
        trade_text = _CoachTradeData.format_trade(trade_dict)

        context_parts = [f"TRADE DATA:\n{trade_text}"]

        if trade_dict.get("emotions"):
            emotion_lines = []
            for e in trade_dict["emotions"]:
                emotion_lines.append(
                    f"  - {e['emotion']}: confidence={e.get('confidence','?')}/10, "
                    f"stress={e.get('stress','?')}/10, conviction={e.get('conviction','?')}/10, "
                    f"patience={e.get('patience','?')}/10, focus={e.get('focus','?')}/10"
                )
            context_parts.append("EMOTIONS:\n" + "\n".join(emotion_lines))

        if trade_dict.get("execution_grade"):
            g = trade_dict["execution_grade"]
            context_parts.append(
                f"EXECUTION GRADES: overall={g.get('overall','?')}, entry={g.get('entry','?')}, "
                f"sizing={g.get('sizing','?')}, stop={g.get('stop','?')}, "
                f"patience={g.get('patience','?')}, rules={g.get('rules','?')}, exit={g.get('exit','?')}"
            )

        if trade_dict.get("partial_exits"):
            pe_lines = []
            for pe in trade_dict["partial_exits"]:
                pe_lines.append(
                    f"  - qty={pe['qty']} @ {pe['exit_price']}, "
                    f"pnl={pe.get('realized_pnl', '?')}, R={pe.get('r_captured', '?')}, "
                    f"reason={pe.get('exit_reason', '?')}"
                )
            context_parts.append("PARTIAL EXITS:\n" + "\n".join(pe_lines))

        if trade_dict.get("key_events"):
            event_lines = []
            for evt in trade_dict["key_events"]:
                event_lines.append(f"  - {evt['type']}: {evt.get('value', '')} {evt.get('note', '')}")
            context_parts.append("TIMELINE:\n" + "\n".join(event_lines))

        if trade_dict.get("playbook"):
            pb = trade_dict["playbook"]
            pb_lines = [f"Setup: {pb['name']}"]
            if pb.get("description"):
                pb_lines.append(f"Description: {pb['description']}")
            if pb.get("rules"):
                pb_lines.append("Rules:")
                for i, rule in enumerate(pb["rules"], 1):
                    pb_lines.append(f"  {i}. {rule}")
            if pb.get("ideal_conditions"):
                pb_lines.append("Ideal conditions: " + ", ".join(pb["ideal_conditions"]))
            context_parts.append("PLAYBOOK:\n" + "\n".join(pb_lines))

        user_prompt = "\n\n".join(context_parts)

        logger.info("generating_trade_review", trade_id=trade_dict.get("id"))

        messages = [
            {"role": "system", "content": TRADE_REVIEW_SYSTEM},
            {"role": "user", "content": user_prompt},
        ]
        raw = await self._chat(messages, max_tokens=2500)

        parsed = _parse_json_response(raw)

        required_keys = ["overall_verdict", "summary", "scores", "strengths", "weaknesses", "discipline_score"]
        for key in required_keys:
            if key not in parsed:
                parsed[key] = _default_review_value(key)

        if "scores" in parsed and isinstance(parsed["scores"], dict):
            for skey in ["entry_timing", "exit_timing", "risk_management", "plan_adherence", "psychology", "overall"]:
                parsed["scores"].setdefault(skey, 5)

        return parsed

    async def check_rule_reminders(
        self,
        trades: List[dict],
        rules: Optional[List[str]] = None,
    ) -> str:
        """Check trades against a set of trading rules and return a reminder."""
        trade_text = _CoachTradeData.format_trades_summary(trades)
        rules_text = "\n".join(f"{i+1}. {r}" for i, r in enumerate(rules)) if rules else ""

        default_rules = (
            "1. Always set a stop-loss before entry\n"
            "2. Never average down on a losing position\n"
            "3. Risk no more than 2% of capital per trade\n"
            "4. Maximum 3 trades per day — no revenge trading\n"
            "5. Don't exit before stop-loss or target unless thesis is invalidated"
        )

        rules_block = rules_text if rules_text else default_rules

        user_prompt = (
            f"TRADES TO EVALUATE:\n{trade_text}\n\n"
            f"RULES TO CHECK:\n{rules_block}\n\n"
            "For each rule, state COMPLIANT or VIOLATED with brief evidence. "
            "End with a one-line summary reminder for the trader. "
            "Keep it under 200 words. Be direct."
        )

        logger.info("checking_rule_reminders", trade_count=len(trades), custom_rules=bool(rules))
        messages = [
            {"role": "system", "content": RULE_REMINDER_SYSTEM},
            {"role": "user", "content": user_prompt},
        ]
        return await self._chat(messages, max_tokens=1000)


# ──────────────────────── Trade data helpers ────────────────────────


def trade_to_dict(t: object, lifecycle: dict | None = None, partial_exits: list | None = None, playbook: dict | None = None) -> dict:
    """Convert a Trade ORM row to a plain dict for the AI coach.

    If lifecycle dict is provided, includes emotion logs, execution grades,
    and timeline events for richer AI context.
    If partial_exits is provided, includes partial exit data.
    If playbook is provided, includes setup rules and conditions.
    """
    base = {
        "id": t.id,
        "symbol": t.symbol,
        "direction": t.direction,
        "entry_price": str(t.entry_price),
        "exit_price": str(t.exit_price) if t.exit_price else None,
        "quantity": str(t.quantity),
        "fees": str(t.fees) if getattr(t, "fees", None) else "0",
        "pnl": str(t.pnl) if t.pnl else None,
        "setup": t.setup,
        "tactic": t.tactic,
        "notes": t.notes,
        "stop_price": str(t.stop_price) if t.stop_price else None,
        "target_price": str(t.target_price) if getattr(t, "target_price", None) else None,
        "r_multiple": str(t.r_multiple) if t.r_multiple else None,
        "exit_reason": getattr(t, "exit_reason", None),
        "entry_time": t.entry_time.isoformat() if t.entry_time else None,
        "exit_time": t.exit_time.isoformat() if t.exit_time else None,
    }
    if lifecycle:
        if lifecycle.get("emotions"):
            base["emotions"] = [
                {"emotion": e.emotion, "confidence": e.confidence, "stress": e.stress,
                 "conviction": e.conviction, "patience": e.patience, "focus": e.focus}
                for e in lifecycle["emotions"]
            ]
        if lifecycle.get("grade"):
            g = lifecycle["grade"]
            base["execution_grade"] = {
                "overall": g.overall_grade, "entry": g.entry_quality,
                "sizing": g.sizing_quality, "stop": g.stop_quality,
                "patience": g.patience, "rules": g.rule_adherence, "exit": g.exit_quality,
            }
        if lifecycle.get("timeline"):
            base["key_events"] = [
                {"type": e.event_type, "value": e.new_value, "note": e.note}
                for e in lifecycle["timeline"][:10]
            ]
    if partial_exits:
        base["partial_exits"] = [
            {
                "qty": str(pe.qty),
                "exit_price": str(pe.exit_price),
                "exit_time": pe.exit_time.isoformat() if pe.exit_time else None,
                "realized_pnl": str(pe.realized_pnl) if pe.realized_pnl else None,
                "r_captured": str(pe.r_captured) if pe.r_captured else None,
                "exit_reason": pe.exit_reason,
                "note": pe.note,
            }
            for pe in partial_exits
        ]
    if playbook:
        base["playbook"] = {
            "name": playbook.get("name", ""),
            "description": playbook.get("description", ""),
            "rules": playbook.get("rules", []),
            "ideal_conditions": playbook.get("ideal_conditions", []),
            "risk_profile": playbook.get("risk_profile", {}),
        }
    return base


def compute_summary_stats(trades: list) -> dict:
    """Compute basic summary statistics for a set of trades."""
    total = len(trades)
    if total == 0:
        return {"total_trades": 0, "win_rate": "N/A", "total_pnl": "0.00", "avg_pnl": "0.00"}
    from decimal import Decimal
    wins = sum(1 for t in trades if t.pnl and t.pnl > 0)
    win_rate = (wins / total * 100) if total > 0 else 0.0
    total_pnl = sum(t.pnl or Decimal("0") for t in trades)
    avg_pnl = total_pnl / total if total > 0 else Decimal("0")
    return {
        "total_trades": total, "wins": wins, "losses": total - wins,
        "win_rate": f"{win_rate:.1f}%", "total_pnl": str(total_pnl), "avg_pnl": str(avg_pnl),
    }


def compute_setup_performance(trades: list) -> dict:
    """Aggregate PnL, win count, and count per setup type."""
    from decimal import Decimal
    setups: dict[str, dict] = {}
    for t in trades:
        setup = t.setup or "Uncategorized"
        if setup not in setups:
            setups[setup] = {"count": 0, "total_pnl": Decimal("0"), "wins": 0}
        pnl = t.pnl or Decimal("0")
        setups[setup]["count"] += 1
        setups[setup]["total_pnl"] += pnl
        if pnl > 0:
            setups[setup]["wins"] += 1
    return {
        k: {
            "count": v["count"], "total_pnl": str(v["total_pnl"]),
            "wins": v["wins"],
            "win_rate": f"{v['wins'] / v['count'] * 100:.1f}%" if v["count"] > 0 else "N/A",
        }
        for k, v in setups.items()
    }


# ──────────────────────── Data Classes (for internal use) ────────────────────────


class _CoachTradeData:
    """Internal helper to format a trade dict for prompts."""

    @staticmethod
    def format_trade(t: dict) -> str:
        lines = [
            f"Symbol: {t.get('symbol', '?')}",
            f"Direction: {t.get('direction', '?')}",
            f"Entry: {t.get('entry_price', '?')} @ {t.get('entry_time', 'N/A')}",
            f"Exit: {t.get('exit_price', 'Open')} @ {t.get('exit_time', 'N/A')}",
            f"Quantity: {t.get('quantity', '?')}",
            f"PnL: {t.get('pnl', 'N/A')}",
            f"Setup: {t.get('setup', 'N/A')}",
            f"Tactic: {t.get('tactic', 'N/A')}",
            f"Stop: {t.get('stop_price', 'N/A')}",
            f"R-Multiple: {t.get('r_multiple', 'N/A')}",
        ]
        if t.get('notes'):
            lines.append(f"Notes: {t['notes']}")
        return "\n".join(lines)

    @staticmethod
    def format_trades_summary(trades: List[dict]) -> str:
        if not trades:
            return "No trades in this period."
        return "\n\n".join(
            f"--- Trade {i+1} ---\n{_CoachTradeData.format_trade(t)}"
            for i, t in enumerate(trades)
        )


def _parse_json_response(raw: str) -> dict:
    """Parse JSON from an LLM response, handling markdown fences and preamble."""
    text = raw.strip()
    if text.startswith("```json"):
        text = text[len("```json"):]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        for line in text.split("\n"):
            line = line.strip()
            if line.startswith("{"):
                try:
                    return json.loads(line)
                except (json.JSONDecodeError, TypeError):
                    continue
    return {"raw_response": raw[:2000]}


def _default_review_value(key: str):
    defaults = {
        "overall_verdict": "poor_execution",
        "summary": "Review generation failed.",
        "strengths": [],
        "weaknesses": [],
        "rule_violations": [],
        "missed_opportunity": None,
        "coaching_notes": "Review generation failed. Try again.",
        "discipline_score": 0,
    }
    return defaults.get(key, None)


# ──────────────────────── Response Cache (TTL-based) ────────────────────────


class ReviewCache:
    """In-memory cache for coach reviews with configurable TTL."""

    def __init__(self, ttl_seconds: int = 86400) -> None:
        self._cache: dict[str, tuple[float, str, int]] = {}
        self._ttl = ttl_seconds

    def get(self, key: str) -> Optional[tuple[str, int]]:
        """Return (content, trades_analyzed) or None if expired."""
        if key in self._cache:
            stored_at, content, trades_count = self._cache[key]
            if time.time() - stored_at < self._ttl:
                return (content, trades_count)
            del self._cache[key]
        return None

    def set(self, key: str, content: str, trades_analyzed: int = 0) -> None:
        self._cache[key] = (time.time(), content, trades_analyzed)

    def clear(self) -> None:
        self._cache.clear()

    def __len__(self) -> int:
        return len(self._cache)


def review_cache_key(
    review_type: str,
    period_start: str,
    period_end: str,
    trade_ids: str = "",
) -> str:
    """Deterministic cache key for a review."""
    raw = f"{review_type}:{period_start}:{period_end}:{trade_ids}"
    return hashlib.md5(raw.encode()).hexdigest()


# ──────────────────────── Singletons ────────────────────────

ai_coach = AICoachService()
review_cache = ReviewCache()
