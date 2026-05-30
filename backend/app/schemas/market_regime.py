"""Pydantic schemas for the Market Regime Intelligence engine.

All metrics are derived from existing MarketSnapshot fields + closed trade
R-multiples. No new indicators, no LLM scoring. User-scoped, read-only.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class MarketRegimeType(str, Enum):
    TRENDING_BULL = "TRENDING_BULL"
    TRENDING_BEAR = "TRENDING_BEAR"
    RANGE_BOUND = "RANGE_BOUND"
    HIGH_VOLATILITY = "HIGH_VOLATILITY"
    LOW_VOLATILITY = "LOW_VOLATILITY"
    BREAKOUT = "BREAKOUT"
    REVERSAL = "REVERSAL"
    UNKNOWN = "UNKNOWN"


class RegimeConfidence(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RegimeStatus(str, Enum):
    FAVORABLE = "FAVORABLE"
    NEUTRAL = "NEUTRAL"
    UNFAVORABLE = "UNFAVORABLE"


class RegimePerformance(BaseModel):
    regime: MarketRegimeType
    sample_size: int = 0
    wins: int = 0
    losses: int = 0
    breakeven: int = 0
    win_rate: Optional[float] = None
    avg_r: Optional[float] = None
    expectancy_r: Optional[float] = None
    profit_factor: Optional[float] = None
    total_pnl: Optional[float] = None
    confidence: RegimeConfidence = RegimeConfidence.LOW
    status: RegimeStatus = RegimeStatus.NEUTRAL


class RegimePerformanceResponse(BaseModel):
    generated_at: str
    regimes: list[RegimePerformance] = Field(default_factory=list)
    matched_trades: int = 0
    favorable_regimes: list[MarketRegimeType] = Field(default_factory=list)
    unfavorable_regimes: list[MarketRegimeType] = Field(default_factory=list)


class SetupRegimeCell(BaseModel):
    regime: MarketRegimeType
    sample_size: int = 0
    avg_r: Optional[float] = None
    expectancy_r: Optional[float] = None
    win_rate: Optional[float] = None
    confidence: RegimeConfidence = RegimeConfidence.LOW


class SetupRegimeRow(BaseModel):
    setup: str
    cells: list[SetupRegimeCell] = Field(default_factory=list)
    best_regime: Optional[MarketRegimeType] = None
    worst_regime: Optional[MarketRegimeType] = None


class SetupRegimeMatrix(BaseModel):
    generated_at: str
    regimes: list[MarketRegimeType] = Field(default_factory=list)
    rows: list[SetupRegimeRow] = Field(default_factory=list)


class CurrentRegime(BaseModel):
    regime: MarketRegimeType
    confidence: RegimeConfidence = RegimeConfidence.LOW
    as_of_date: Optional[str] = None
    status: RegimeStatus = RegimeStatus.NEUTRAL
    reasoning: list[str] = Field(default_factory=list)
    # Raw signals used for classification (existing snapshot fields)
    nifty_trend: Optional[str] = None
    nifty_regime: Optional[str] = None
    nifty_change_pct: Optional[float] = None
    india_vix: Optional[float] = None
    atr_pct: Optional[float] = None
    advance_decline_ratio: Optional[float] = None
    # Best/worst setup for the active regime (data-driven)
    best_setup: Optional[str] = None
    best_setup_expectancy_r: Optional[float] = None
    worst_setup: Optional[str] = None
    worst_setup_expectancy_r: Optional[float] = None


class MarketRegimeDashboard(BaseModel):
    generated_at: str
    current: Optional[CurrentRegime] = None
    performance: RegimePerformanceResponse
    matrix: SetupRegimeMatrix
