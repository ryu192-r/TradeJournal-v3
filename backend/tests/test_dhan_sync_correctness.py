"""Tests for Dhan sync and webhook correctness: idempotency, pairing, replay, security."""
import os
import pytest
from decimal import Decimal
from datetime import datetime

from app.core.security import get_password_hash
from app.db.database import Base, SessionLocal, engine as real_engine
from app.models.user import User
from app.models.account import Account
from app.models.trade import Trade
from app.models.trade_timeline import TradeTimeline
from app.services.trade_service import TradeService


_email_counter = 0


def _next_email():
    global _email_counter
    _email_counter += 1
    return f"dhan-test-{_email_counter}@example.com"


def _make_user(db):
    user = User(email=_next_email(), full_name="Dhan Test", hashed_password=get_password_hash("test"))
    db.add(user)
    db.flush()
    return user


def _make_account(db, user_id):
    acc = Account(user_id=user_id, name="Default", broker="Dhan", initial_balance=Decimal("100000"), current_balance=Decimal("100000"))
    db.add(acc)
    db.flush()
    return acc


@pytest.fixture
def db_session():
    Base.metadata.drop_all(bind=real_engine)
    Base.metadata.create_all(bind=real_engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=real_engine)


class MockDhanLeg:
    def __init__(self, symbol, price, quantity, order_timestamp, exchange_order_id, leg_type):
        self.trading_symbol = symbol
        self.price = Decimal(str(price))
        self.quantity = quantity
        self.order_timestamp = order_timestamp
        self.exchange_order_id = exchange_order_id
        self.leg_type = leg_type  # OPEN / CLOSE


class TestDhanSyncIdempotency:
    def test_repeated_sync_no_duplicate(self, db_session):
        user = _make_user(db_session)
        _make_account(db_session, user.id)
        svc = TradeService(db_session)
        open_leg = MockDhanLeg("RELIANCE", "100", 10, "2024-01-15T09:20:00+00:00", "oid1", "OPEN")
        close_leg = MockDhanLeg("RELIANCE", "110", 10, "2024-01-15T14:30:00+00:00", "oid1", "CLOSE")
        from app.services.import_normalization import parse_datetime
        td = {
            "user_id": user.id,
            "symbol": open_leg.trading_symbol,
            "direction": "LONG",
            "entry_price": open_leg.price,
            "exit_price": close_leg.price,
            "quantity": open_leg.quantity,
            "entry_time": parse_datetime(open_leg.order_timestamp),
            "exit_time": parse_datetime(close_leg.order_timestamp),
            "fees": Decimal("0"),
            "external_order_id": open_leg.exchange_order_id,
            "import_source": "dhan_sync",
        }
        t1, a1, _ = svc.import_trade(td)
        db_session.commit()
        t2, a2, _ = svc.import_trade(td)
        db_session.commit()
        assert a1 == "created"
        assert a2 == "merged"
        assert t1.id == t2.id

    def test_same_day_reentry_separate(self, db_session):
        user = _make_user(db_session)
        svc = TradeService(db_session)
        from app.services.import_normalization import parse_datetime
        td1 = {
            "user_id": user.id,
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("100"),
            "exit_price": Decimal("110"),
            "quantity": 10,
            "entry_time": parse_datetime("2024-01-15T09:20:00+00:00"),
            "exit_time": parse_datetime("2024-01-15T10:30:00+00:00"),
            "fees": Decimal("0"),
            "external_order_id": "oid1",
            "import_source": "dhan_sync",
        }
        td2 = {
            "user_id": user.id,
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("105"),
            "exit_price": Decimal("115"),
            "quantity": 10,
            "entry_time": parse_datetime("2024-01-15T11:00:00+00:00"),
            "exit_time": parse_datetime("2024-01-15T14:00:00+00:00"),
            "fees": Decimal("0"),
            "external_order_id": "oid2",
            "import_source": "dhan_sync",
        }
        t1, _, _ = svc.import_trade(td1)
        t2, _, _ = svc.import_trade(td2)
        db_session.commit()
        assert t1.id != t2.id


class TestDhanWebhookSecurity:
    def test_user_id_from_env(self):
        import importlib
        import app.routers.dhan_webhook as dhan_webhook_mod
        os.environ["DHAN_WEBHOOK_USER_ID"] = "1"
        importlib.reload(dhan_webhook_mod)
        assert dhan_webhook_mod._get_webhook_user_id() == 1
        del os.environ["DHAN_WEBHOOK_USER_ID"]
        importlib.reload(dhan_webhook_mod)

    def test_user_id_missing_raises(self):
        import importlib
        import app.routers.dhan_webhook as dhan_webhook_mod
        if "DHAN_WEBHOOK_USER_ID" in os.environ:
            del os.environ["DHAN_WEBHOOK_USER_ID"]
        importlib.reload(dhan_webhook_mod)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            dhan_webhook_mod._get_webhook_user_id()
        assert exc.value.status_code == 403
        importlib.reload(dhan_webhook_mod)

    def test_signature_verification(self):
        import importlib
        import app.routers.dhan_webhook as dhan_webhook_mod
        os.environ["DHAN_WEBHOOK_SECRET"] = "mysecret"
        importlib.reload(dhan_webhook_mod)
        raw_body = b'{"test":1}'
        import hmac, hashlib
        sig = hmac.new("mysecret".encode(), raw_body, hashlib.sha256).hexdigest()
        assert dhan_webhook_mod._verify_webhook_signature(raw_body, sig) is True
        assert dhan_webhook_mod._verify_webhook_signature(raw_body, "bad") is False
        del os.environ["DHAN_WEBHOOK_SECRET"]
        importlib.reload(dhan_webhook_mod)


class TestDhanWebhookProcessing:
    def test_close_existing_open_trade(self, db_session):
        user = _make_user(db_session)
        _make_account(db_session, user.id)
        svc = TradeService(db_session)
        td = {
            "user_id": user.id,
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("100"),
            "quantity": Decimal("10"),
            "entry_time": datetime.fromisoformat("2024-01-15T09:20:00"),
            "fees": Decimal("0"),
            "import_source": "broker_csv:generic",
        }
        trade, _, _ = svc.import_trade(td)
        db_session.commit()
        assert trade.status == "open"

        from app.services.dhan_webhook_service import DhanWebhookService
        whsvc = DhanWebhookService(db_session, user_id=user.id)
        closed, error = whsvc.process_event(
            symbol="RELIANCE",
            direction="LONG",
            exit_price=Decimal("110"),
            exit_time=datetime.fromisoformat("2024-01-15T14:30:00"),
            order_type="MARKET",
            order_id="oid-webhook-1",
            fees=Decimal("0"),
            event_id="evt-1",
        )
        assert error is None
        assert closed is not None
        assert closed.status == "closed_manual"
        assert closed.exit_price == Decimal("110")

    def test_webhook_no_match_returns_none(self, db_session):
        user = _make_user(db_session)
        from app.services.dhan_webhook_service import DhanWebhookService
        whsvc = DhanWebhookService(db_session, user_id=user.id)
        trade, error = whsvc.process_event(
            symbol="UNKNOWN",
            direction="LONG",
            exit_price=Decimal("110"),
            exit_time=datetime.now(),
            order_type="MARKET",
            order_id="oid-1",
            event_id="evt-2",
        )
        assert trade is None
        assert error is None
