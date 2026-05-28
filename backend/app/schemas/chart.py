from pydantic import BaseModel, Field
from typing import Optional, List


class CandleResponse(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: Optional[int] = None


class ChartMarkerResponse(BaseModel):
    time: int
    position: str = Field(..., description="belowBar or aboveBar")
    shape: str = Field(..., description="arrowUp, arrowDown, circle, etc.")
    color: str
    text: str


class PriceLineResponse(BaseModel):
    price: float
    title: str
    color: str


class ChartAnnotationsResponse(BaseModel):
    entry_time: Optional[str] = None
    exit_time: Optional[str] = None
    partial_exits: List[dict] = Field(default_factory=list)


class ChartMetaResponse(BaseModel):
    has_real_data: bool = False
    is_mock: bool = False
    message: Optional[str] = None


class ChartDataResponse(BaseModel):
    trade_id: int
    symbol: str
    timeframe: str
    range: str
    source: str
    candles: List[CandleResponse] = Field(default_factory=list)
    markers: List[ChartMarkerResponse] = Field(default_factory=list)
    price_lines: List[PriceLineResponse] = Field(default_factory=list)
    annotations: ChartAnnotationsResponse = Field(default_factory=ChartAnnotationsResponse)
    meta: ChartMetaResponse = Field(default_factory=ChartMetaResponse)