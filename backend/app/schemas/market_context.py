from decimal import Decimal
from pydantic import BaseModel, Field


class MarketSnapshotCreate(BaseModel):
    date: str
    nifty_close: Decimal | None = None
    nifty_change_pct: Decimal | None = None
    nifty_high: Decimal | None = None
    nifty_low: Decimal | None = None
    nifty_open: Decimal | None = None
    nifty_trend: str | None = None
    nifty_regime: str | None = None
    india_vix: Decimal | None = None
    atr_14: Decimal | None = None
    atr_pct: Decimal | None = None
    advance_count: int | None = None
    decline_count: int | None = None
    advance_decline_ratio: Decimal | None = None
    sector_strength: dict | None = None
    fii_flow_cr: Decimal | None = None
    dii_flow_cr: Decimal | None = None
    is_earnings_season: str | None = None
    macro_events: list | None = None
    notes: str | None = None


class MarketSnapshotResponse(BaseModel):
    id: int
    date: str
    nifty_trend: str | None = None
    nifty_regime: str | None = None
    message: str = "Snapshot saved"


class LiveQuoteItem(BaseModel):
    symbol: str
    ltp: Decimal
    company_name: str | None = None
    change: Decimal | None = None
    change_pct: Decimal | None = None
    volume: int | None = None
    high_52w: Decimal | None = None
    low_52w: Decimal | None = None
    pe: Decimal | None = None
    market_cap_cr: Decimal | None = None
    sector: str | None = None


class LiveQuotesRequest(BaseModel):
    quotes: list[LiveQuoteItem]


class LiveQuotesResponse(BaseModel):
    upserted: int
    errors: list[str]
    total: int
    provider_status: str
