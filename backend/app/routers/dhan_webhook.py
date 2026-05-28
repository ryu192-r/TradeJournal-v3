"""Dhan webhook handler for real-time stop-loss/target hit notifications."""
import os
import hmac
import hashlib
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Response, status, Header

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

router = APIRouter(prefix="/webhooks/dhan", tags=["dhan-webhook"])


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


def _verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify HMAC-SHA256 webhook signature."""
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _get_webhook_user_id() -> int:
    """Return fixed user_id for single-account personal webhook.
    Require DHAN_WEBHOOK_USER_ID env var."""
    raw = os.environ.get("DHAN_WEBHOOK_USER_ID")
    if not raw:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Webhook user mapping not configured")
    try:
        return int(raw)
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
    event: DhanWebhookEvent,
    response: Response,
    x_webhook_signature: str | None = Header(default=None, alias="X-Webhook-Signature"),
    db=Depends(get_db),
) -> Union[WebhookTradeUpdateResponse, WebhookUnmatchedResponse]:
    """Receive single Dhan order fill event. Requires X-Webhook-Signature header if DHAN_WEBHOOK_SECRET set."""
    secret = os.environ.get("DHAN_WEBHOOK_SECRET")
    if secret:
        # Require signature
        if not x_webhook_signature:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing webhook signature")
        import json
        payload = json.dumps(event.model_dump(by_alias=True), separators=(",", ":")).encode("utf-8")
        if not _verify_webhook_signature(payload, x_webhook_signature, secret):
            logger.warning("webhook_signature_rejected", event_id=event.event_id)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

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
    )

    if error:
        logger.error("webhook_processing_error", event_id=event.event_id, symbol=event.symbol, error=str(error))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error))

    if trade:
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
    events: list[DhanWebhookEvent],
    x_webhook_signature: str | None = Header(default=None, alias="X-Webhook-Signature"),
    db=Depends(get_db),
) -> WebhookBatchResponse:
    """Process batch webhook events."""
    secret = os.environ.get("DHAN_WEBHOOK_SECRET")
    if secret:
        if not x_webhook_signature:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing webhook signature")
        import json
        payload = json.dumps([e.model_dump(by_alias=True) for e in events], separators=(",", ":")).encode("utf-8")
        if not _verify_webhook_signature(payload, x_webhook_signature, secret):
            logger.warning("batch_webhook_signature_rejected", event_count=len(events))
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    user_id = _get_webhook_user_id()
    svc = DhanWebhookService(db, user_id=user_id)

    results: list[WebhookBatchResultEntry] = []
    matched_count = 0
    unmatched_count = 0
    error_count = 0
    seen_ids = set()

    for event in events:
        # Replay dedup
        if event.event_id in seen_ids:
            unmatched_count += 1
            results.append(WebhookBatchResultEntry(
                event_id=event.event_id,
                symbol=event.symbol,
                status="duplicate",
            ))
            continue
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
