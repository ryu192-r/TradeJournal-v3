"""Smoke test for Dhan webhook endpoints."""
import sys
sys.path.insert(0, '.')

from app.schemas.webhook import (
    DhanWebhookEvent,
    WebhookBatchResponse,
    WebhookTradeUpdateResponse,
    WebhookBatchResultEntry,
)

def test_schema_imports():
    print("PASS: Schema imports OK")

def test_schema_with_camelcase_aliases():
    """Test that DhanWebhookEvent correctly parses real webhook JSON (camelCase)."""
    payload = {
        "eventId": "evt_123",
        "tradingSymbol": "RELIANCE-EQ",
        "exchange": "NSE",
        "transactionType": "SELL",
        "tradedQuantity": "10",
        "tradedPrice": "2450.50",
        "orderId": "ord_456",
        "exchangeOrderId": "ex_789",
        "orderType": "SL-M",
        "productType": "INTRADAY",
        "orderDateTime": "2026-05-13 09:30:00",
        "triggerPrice": "2440.00",
        "remarks": "SL hit",
    }
    event = DhanWebhookEvent(**payload)
    assert event.event_id == "evt_123"
    assert event.symbol == "RELIANCE-EQ"
    assert event.transaction_type == "SELL"
    assert str(event.price) == "2450.50"
    assert str(event.stop_price) == "2440.00"
    assert event.order_type == "SL-M"
    assert event.remarks == "SL hit"
    print("PASS: Schema parses real Dhan webhook JSON correctly")

def test_service_exit_reason_logic():
    """Test exit reason determination without needing a DB."""
    from app.services.dhan_webhook_service import (
        DhanWebhookService,
        ORDER_TYPE_TO_EXIT_REASON,
    )
    # Test order type mapping
    assert ORDER_TYPE_TO_EXIT_REASON["SL"] == "stop_loss"
    assert ORDER_TYPE_TO_EXIT_REASON["SL-M"] == "stop_loss"
    assert ORDER_TYPE_TO_EXIT_REASON["LIMIT"] == "manual"
    assert ORDER_TYPE_TO_EXIT_REASON["MARKET"] == "manual"
    print("PASS: Order type to exit reason mapping is correct")

def test_service_status_mapping():
    """Test status mapping from exit reason."""
    from app.services.dhan_webhook_service import DhanWebhookService
    
    # Create temporary service (we won't use the DB, just test the method)
    class FakeSvc:
        _status_from_exit_reason = DhanWebhookService._status_from_exit_reason
    
    assert FakeSvc._status_from_exit_reason(FakeSvc(), "stop_loss") == "closed_sl_hit"
    assert FakeSvc._status_from_exit_reason(FakeSvc(), "target") == "closed_target_hit"
    assert FakeSvc._status_from_exit_reason(FakeSvc(), "manual") == "closed_manual"
    assert FakeSvc._status_from_exit_reason(FakeSvc(), "trailing") == "closed_sl_hit"
    assert FakeSvc._status_from_exit_reason(FakeSvc(), "system") == "closed_manual"
    print("PASS: Status mapping from exit reason is correct")

def test_router_imports():
    """Test that the router and all its dependencies import cleanly."""
    from app.routers.dhan_webhook import (
        router,
        handle_dhan_webhook,
        handle_dhan_webhook_batch,
        _parse_exit_time,
    )
    assert router is not None
    assert handle_dhan_webhook is not None
    assert handle_dhan_webhook_batch is not None
    assert _parse_exit_time is not None
    print("PASS: Router imports cleanly")

def test_parse_exit_time():
    from app.routers.dhan_webhook import _parse_exit_time
    from datetime import timezone
    
    # Test ISO format with Z
    t1 = _parse_exit_time("2026-05-13T09:30:00Z")
    assert t1 is not None
    
    # Test standard format
    t2 = _parse_exit_time("2026-05-13 09:30:00")
    assert t2.year == 2026
    assert t2.month == 5
    assert t2.hour == 9
    print("PASS: Timestamp parsing works for common formats")

if __name__ == "__main__":
    test_schema_imports()
    test_schema_with_camelcase_aliases()
    test_service_exit_reason_logic()
    test_service_status_mapping()
    test_router_imports()
    test_parse_exit_time()
    print("\n✓ All smoke tests passed (5/5)")
