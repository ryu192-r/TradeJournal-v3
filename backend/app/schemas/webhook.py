"""Pydantic schemas for Dhan webhook payloads."""
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


from app.utils.decimal_utils import ensure_decimal as _ensure_decimal


class DhanWebhookEvent(BaseModel):
    """Expected Dhan webhook payload for order fill events.

    Field aliases match the real Dhan webhook JSON keys so that the
    incoming payload is parsed correctly regardless of whether the
    keys arrive in camelCase or snake_case.
    """

    event_id: str = Field(
        ...,
        alias="eventId",
        description="Unique event ID from Dhan",
    )
    symbol: str = Field(
        ...,
        alias="tradingSymbol",
        description="Trading symbol (e.g. RELIANCE-EQ)",
    )
    exchange: str = Field(..., description="Exchange segment (NSE, BSE, etc.)")
    transaction_type: str = Field(
        ...,
        alias="transactionType",
        description="BUY or SELL",
    )
    quantity: Decimal = Field(
        ...,
        alias="tradedQuantity",
        description="Traded quantity",
    )
    price: Decimal = Field(
        ...,
        alias="tradedPrice",
        description="Trade execution price",
    )
    order_id: str = Field(..., alias="orderId", description="Dhan order ID")
    exchange_order_id: str = Field(
        ...,
        alias="exchangeOrderId",
        description="Exchange order ID",
    )
    order_type: str = Field(
        ...,
        alias="orderType",
        description="Order type (SL, SL-M, LIMIT, MARKET)",
    )
    product_type: str = Field(
        ...,
        alias="productType",
        description="Product type (INTRADAY, DELIVERY, etc.)",
    )
    timestamp: str = Field(
        ...,
        alias="orderDateTime",
        description="Order execution timestamp",
    )

    # Optional fields used by the exit-reason heuristic
    stop_price: Optional[Decimal] = Field(
        None,
        alias="triggerPrice",
        description="Stop-loss trigger price attached to the order",
    )
    target_price: Optional[Decimal] = Field(
        None,
        description="Target price if set on the order",
    )
    remarks: Optional[str] = Field(
        None,
        description="Additional remarks from broker (often hints at SL/Target hit)",
    )

    model_config = ConfigDict(populate_by_name=True)


class WebhookTradeUpdateResponse(BaseModel):
    """Response from webhook trade processing."""

    trade_id: Optional[int] = None
    symbol: str
    direction: str
    status: str
    exit_reason: Optional[str] = None
    matched: bool = True


class WebhookUnmatchedResponse(BaseModel):
    """Response when webhook doesn't match any open trade."""

    trade_id: Optional[int] = None
    symbol: str
    matched: bool = False
    reason: str


class WebhookBatchResultEntry(BaseModel):
    """Single event result in batch processing."""

    event_id: str
    symbol: str
    status: str
    error: Optional[str] = None
    exit_reason: Optional[str] = None
    trade_id: Optional[int] = None


class WebhookBatchResponse(BaseModel):
    """Batch webhook processing result."""

    total_events: int
    matched: int
    unmatched: int
    errors: int
    results: list[WebhookBatchResultEntry]
