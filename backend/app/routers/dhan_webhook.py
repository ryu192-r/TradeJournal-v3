"""Dhan webhook handler for real-time stop-loss/target hit notifications."""
import os
import hmac
import hashlib
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Response, status, Header, Request

from app.db.database import get_db
from app.schemas.webhook import (
    DhanWebhookEvent,
    WebhookTradeUpdateResponse,
    WebhookUnmatchedResponse,
    WebhookBatchResultEntry,
    WebhookBatchResponse,
)
from app.services.dhan_webhook_service import DhanWebhookService

logger = logging.getLogger(__name__)

DHAN_WEBHOOK_SECRET = os.environ.get("DHAN_WEBHOOK_SECRET")
DHAN_WEBHOOK_USER_ID = os.environ.get("DHAN_WEBHOOK_USER_ID")
DHAN_WEBHOOK_DEDUP_HOURS = int(os.environ.get("DHAN_WEBHOOK_DEDUP_HOURS", "168"))


def _parse_exit_time(timestamp_str: str) -> datetime:
    """Parse Dhan order timestamp to datetime."""
    ts = timestamp_str.strip() if timestamp_str else ""
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        pass
    try:
        return datetime.strptime(ts, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError):
        pass
    logger.warning("could_not_parse_timestamp", timestamp=timestamp_str)
    return datetime.now(timezone.utc)


router = APIRouter(prefix="/webhooks/dhan", tags=["dhan-webhook"])


def _verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    """Verify HMAC-SHA256 webhook signature against raw request body bytes."""
    if not DHAN_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Webhook secret not configured")
    if not signature:
        return False
    expected = hmac.new(DHAN_WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _get_webhook_user_id() -> int:
    """Return fixed user_id for single-account personal webhook.
    Require DHAN_WEBHOOK_USER_ID env var."""
    if not DHAN_WEBHOOK_USER_ID:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Webhook user mapping not configured")
    try:
        return int(DHAN_WEBHOOK_USER_ID)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid DHAN_WEBHOOK_USER_ID")


@router.post(
    "/",
    response_model=Union[WebhookTradeUpdateResponse, WebhookUnmatchedResponse],
    responses={
        200: {"description": "Webhook processed"},
        400: {"description": "Invalid payload"},
        401: {"description": "Missing/invalid signature"},
        403: {"description": "Webhook not configured"},
    },
)
async def handle_dhan_webhook(
    request: Request,
    response: Response,
    x_webhook_signature: str | None = Header(default=None, alias="X-Webhook-Signature"),
    db=Depends(get_db),
) -> Union[WebhookTradeUpdateResponse, WebhookUnmatchedResponse]:
    """Receive single Dhan order fill event. Requires X-Webhook-Signature header.
    Secret is required when DHAN_WEBHOOK_SECRET is configured; without it, 403 is returned."""
    # Read raw body for HMAC verification before any JSON parsing
    raw_body = await request.body()

    # Require secret — without it, webhook endpoints are disabled
    if not DHAN_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Webhook secret not configured")
    if not x_webhook_signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing webhook signature")
    if not _verify_webhook_signature(raw_body, x_webhook_signature):
        logger.warning("webhook_signature_rejected", event_id=getattr(getattr(request, '_body', None), 'event_id', 'unknown'))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    import json
    try:
        event_data = json.loads(raw_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid JSON: {e}")

    # Parse into Pydantic model after verification
    try:
        event = DhanWebhookEvent(**event_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid payload: {e}")

    user_id = _get_webhook_user_id()
    svc = DhanWebhookService(db, user_id=user_id)

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
        event_id=event.event_id,
        defer_commit=True,
    )

    if error:
        db.rollback()
        logger.error("webhook_processing_error", event_id=event.event_id, symbol=event.symbol, error=str(error))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error))

    if trade:
        db.commit()
        return WebhookTradeUpdateResponse(
            trade_id=trade.id,
            symbol=trade.symbol,
            direction=trade.direction,
            status=trade.status,
            exit_reason=trade.exit_reason,
            matched=True,
        )

    logger.info("webhook_unmatched", event_id=event.event_id, symbol=event.symbol, transaction_type=event.transaction_type)
    direction_hint = "LONG" if is_sell else "SHORT"
    return WebhookUnmatchedResponse(
        symbol=event.symbol,
        matched=False,
        reason=f"No open {direction_hint} trade found for {event.symbol}",
    )


@router.post(
    "/batch",
    tags=["dhan-webhook-batch"],
    response_model=WebhookBatchResponse,
)
async def handle_dhan_webhook_batch(
    request: Request,
    x_webhook_signature: str | None = Header(default=None, alias="X-Webhook-Signature"),
    db=Depends(get_db),
) -> WebhookBatchResponse:
    """Process batch webhook events atomically in a single transaction.
    Requires X-Webhook-Signature header when DHAN_WEBHOOK_SECRET is configured."""
    raw_body = await request.body()

    if not DHAN_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Webhook secret not configured")
    if not x_webhook_signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing webhook signature")
    if not _verify_webhook_signature(raw_body, x_webhook_signature):
        logger.warning("batch_webhook_signature_rejected", event_count="unknown")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    import json
    try:
        events_data = json.loads(raw_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid JSON: {e}")

    try:
        events = [DhanWebhookEvent(**e) for e in events_data]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid payload: {e}")

    user_id = _get_webhook_user_id()
    svc = DhanWebhookService(db, user_id=user_id)

    results: list[WebhookBatchResultEntry] = []
    matched_count = 0
    unmatched_count = 0
    error_count = 0
    seen_ids: set = set()

    for event in events:
        # In-batch dedup: skip if same event_id appears twice in this batch
        if event.event_id and event.event_id in seen_ids:
            unmatched_count += 1
            results.append(WebhookBatchResultEntry(
                event_id=event.event_id,
                symbol=event.symbol,
                status="duplicate",
            ))
            continue
        if event.event_id:
            seen_ids.add(event.event_id)

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
            event_id=event.event_id,
            defer_commit=True,
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

    # Single atomic commit for entire batch after all events processed
    try:
        db.commit()
    except Exception as e:
        logger.error("batch_commit_failed", error=str(e), event_count=len(events))
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Batch commit failed")

    return WebhookBatchResponse(
        total_events=len(events),
        matched=matched_count,
        unmatched=unmatched_count,
        errors=error_count,
        results=results,
    )
