"""Dhan webhook handler for real-time stop-loss/target hit notifications."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.db.database import get_db
from app.schemas.webhook import (
    DhanWebhookEvent,
    WebhookTradeUpdateResponse,
    WebhookUnmatchedResponse,
    WebhookBatchResultEntry,
    WebhookBatchResponse,
)
from app.services.dhan_webhook_service import DhanWebhookService

import structlog

router = APIRouter(prefix="/webhooks/dhan", tags=["dhan-webhook"])

logger = structlog.get_logger()


def _parse_exit_time(timestamp_str: str) -> datetime:
    """Parse Dhan order timestamp to datetime."""
    # Dhan timestamps typically come as ISO 8601 strings
    # Handle various formats from Dhan
    ts = timestamp_str.strip()

    # Try ISO format first
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        pass

    # Try common Dhan format: "2024-01-15 09:30:00"
    try:
        return datetime.strptime(ts, "%Y-%m-%d %H:%M:%S").replace(
            tzinfo=timezone.utc
        )
    except (ValueError, AttributeError):
        pass

    # Fallback: current time with a warning
    logger.warning(
        "could_not_parse_timestamp",
        timestamp=timestamp_str,
    )
    return datetime.now(timezone.utc)


@router.post(
    "/",
    response_model=Union[WebhookTradeUpdateResponse, WebhookUnmatchedResponse],
    responses={
        200: {"description": "Webhook processed successfully"},
        400: {"description": "Invalid webhook payload"},
        422: {"description": "Validation error"},
    },
)
async def handle_dhan_webhook(
    event: DhanWebhookEvent,
    response: Response,
    db=Depends(get_db),
) -> Union[WebhookTradeUpdateResponse, WebhookUnmatchedResponse]:
    """Receive a single Dhan order fill event.

    This endpoint is called by Dhan when an order is executed.
    It matches the event against open trades and updates their state.

    For CLOSE/SELL events on existing positions, updates the trade:
    - Sets exit_price and exit_time
    - Computes exit_reason (stop_loss, target, manual, trailing)
    - Transitions status (analytics → closed_sl_hit/closed_target_hit/closed_manual)
    - Records stop_history entry if SL or target hit
    """
    svc = DhanWebhookService(db)

    # Only process exit/close events (SELL for LONG positions, BUY for SHORT)
    is_sell = event.transaction_type.upper() == "SELL"
    is_buy = event.transaction_type.upper() == "BUY"

    # Determine direction based on order context
    # For LONG positions, exit is SELL; for SHORT positions, exit is BUY
    # We'll try both directions to match
    exit_time = _parse_exit_time(event.timestamp)

    trade, error = svc.process_event(
        symbol=event.symbol,
        direction="LONG" if is_sell else "SHORT" if is_buy else None,
        exit_price=event.price,
        exit_time=exit_time,
        order_type=event.order_type,
        order_id=event.order_id,
        fees=Decimal("0"),  # Will be updated during sync if needed
        stop_price=event.stop_price,
        target_price=event.target_price,
        remarks=event.remarks,
    )

    if error:
        # Unexpected error during processing
        logger.error(
            "webhook_processing_error",
            event_id=event.event_id,
            symbol=event.symbol,
            error=str(error),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(error),
        )

    if trade:
        return WebhookTradeUpdateResponse(
            trade_id=trade.id,
            symbol=trade.symbol,
            direction=trade.direction,
            status=trade.status,
            exit_reason=trade.exit_reason,
            matched=True,
        )

    # No matching trade found — log but don't error
    # Dhan may send events for orders we're not tracking
    logger.info(
        "webhook_unmatched",
        event_id=event.event_id,
        symbol=event.symbol,
        transaction_type=event.transaction_type,
    )

    direction_hint = "LONG" if is_sell else "SHORT"
    return WebhookUnmatchedResponse(
        symbol=event.symbol,
        matched=False,
        reason=f"No open {direction_hint} trade found for {event.symbol} with status analytics/reviewed/draft",
    )


@router.post(
    "/batch",
    tags=["dhan-webhook-batch"],
    response_model=WebhookBatchResponse,
)
async def handle_dhan_webhook_batch(
    events: list[DhanWebhookEvent],
    db=Depends(get_db),
) -> WebhookBatchResponse:
    """Process a batch of Dhan webhook events.

    Useful for:
    - Manual re-processing of events
    - Bulk testing of webhook handler
    - Historical event replay

    Returns summary of processed events.
    """
    svc = DhanWebhookService(db)

    results: list[WebhookBatchResultEntry] = []
    matched_count = 0
    unmatched_count = 0
    error_count = 0

    for event in events:
        is_sell = event.transaction_type.upper() == "SELL"
        is_buy = event.transaction_type.upper() == "BUY"
        exit_time = _parse_exit_time(event.timestamp)

        trade, error = svc.process_event(
            symbol=event.symbol,
            direction="LONG" if is_sell else "SHORT" if is_buy else None,
            exit_price=event.price,
            exit_time=exit_time,
            order_type=event.order_type,
            order_id=event.order_id,
            fees=Decimal("0"),
            stop_price=event.stop_price,
            target_price=event.target_price,
            remarks=event.remarks,
        )

        if error:
            error_count += 1
            results.append(WebhookBatchResultEntry(
                event_id=event.event_id,
                symbol=event.symbol,
                status="error",
                error=str(error),
            ))
        elif trade:
            matched_count += 1
            results.append(WebhookBatchResultEntry(
                event_id=event.event_id,
                symbol=event.symbol,
                status=trade.status,
                exit_reason=trade.exit_reason,
                trade_id=trade.id,
            ))
        else:
            unmatched_count += 1
            results.append(WebhookBatchResultEntry(
                event_id=event.event_id,
                symbol=event.symbol,
                status="unmatched",
            ))

    return WebhookBatchResponse(
        total_events=len(events),
        matched=matched_count,
        unmatched=unmatched_count,
        errors=error_count,
        results=results,
    )
