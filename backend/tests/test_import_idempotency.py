"""Tests for import deduplication across all sources: broker CSV, Dhan sync, webhook."""
import pytest
from decimal import Decimal
from datetime import datetime

from app.core.security import get_password_hash
from app.db.database import Base, SessionLocal, engine as real_engine
from app.models.user import User
from app.models.account import Account
from app.models.trade import Trade
from app.services.trade_service import TradeService


_email_counter = 0


def _next_email():
    global _email_counter
    _email_counter += 1
    return f"idemp-test-{_email_counter}@example.com"


def _make_user(db):
    user = User(email=_next_email(), full_name="Idempotency Test", hashed_password=get_password_hash("test"))
    db.add(user)
    db.flush()
    return user


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


class TestImportFingerprintDeduplication:
    def test_fingerprint_same_import_skip(self, db_session):
        user = _make_user(db_session)
        svc = TradeService(db_session)
        td = {
            "user_id": user.id,
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("100"),
            "quantity": Decimal("10"),
            "entry_time": datetime.fromisoformat("2024-01-15T09:20:00"),
            "exit_price": Decimal("110"),
            "exit_time": datetime.fromisoformat("2024-01-15T14:30:00"),
            "fees": Decimal("0"),
            "import_source": "broker_csv:generic",
        }
        t1, a1, _ = svc.import_trade(td)
        db_session.commit()
        t2, a2, _ = svc.import_trade(td)
        db_session.commit()
        assert a1 == "created"
        assert a2 == "merged"
        assert t1.id == t2.id
        count = db_session.query(Trade).filter(Trade.user_id == user.id).count()
        assert count == 1

    def test_different_source_same_data_merges(self, db_session):
        user = _make_user(db_session)
        svc = TradeService(db_session)
        td = {
            "user_id": user.id,
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("100"),
            "quantity": Decimal("10"),
            "entry_time": datetime.fromisoformat("2024-01-15T09:20:00"),
            "exit_price": Decimal("110"),
            "exit_time": datetime.fromisoformat("2024-01-15T14:30:00"),
            "fees": Decimal("0"),
            "import_source": "broker_csv:generic",
        }
        td2 = {**td, "import_source": "dhan_sync"}
        t1, _, _ = svc.import_trade(td)
        t2, a2, _ = svc.import_trade(td2)
        db_session.commit()
        # Same canonical trade data is same trade regardless of source
        assert a2 == "merged"
        assert t1.id == t2.id

    def test_external_order_id_prevents_split(self, db_session):
        user = _make_user(db_session)
        svc = TradeService(db_session)
        td = {
            "user_id": user.id,
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("100"),
            "quantity": Decimal("10"),
            "entry_time": datetime.fromisoformat("2024-01-15T09:20:00"),
            "fees": Decimal("0"),
            "external_order_id": "dhan-oid-1",
            "import_source": "dhan_sync",
        }
        t1, a1, _ = svc.import_trade(td)
        db_session.commit()
        # same external_order_id, different price = conflict → skip
        td2 = {**td, "entry_price": Decimal("101")}
        t2, a2, info = svc.import_trade(td2)
        db_session.commit()
        assert a2 == "merged"
        assert info.get("reason") == "external_order_id_duplicate"
        assert t1.id == t2.id

    def test_same_time_different_price_creates_separate(self, db_session):
        user = _make_user(db_session)
        svc = TradeService(db_session)
        td1 = {
            "user_id": user.id,
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("100"),
            "quantity": Decimal("10"),
            "entry_time": datetime.fromisoformat("2024-01-15T09:20:00"),
            "fees": Decimal("0"),
            "import_source": "broker_csv:generic",
        }
        td2 = {**td1, "entry_price": Decimal("101")}
        t1, a1, _ = svc.import_trade(td1)
        t2, a2, _ = svc.import_trade(td2)
        db_session.commit()
        assert a1 == "created"
        assert a2 == "created"
        assert t1.id != t2.id

    def test_same_user_different_account_other_user_not_matched(self, db_session):
        user_a = _make_user(db_session)
        user_b = _make_user(db_session)
        svc = TradeService(db_session)
        td_a = {
            "user_id": user_a.id,
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("100"),
            "quantity": Decimal("10"),
            "entry_time": datetime.fromisoformat("2024-01-15T09:20:00"),
            "fees": Decimal("0"),
            "import_source": "broker_csv:generic",
        }
        td_b = {**td_a, "user_id": user_b.id}
        t1, _, _ = svc.import_trade(td_a)
        t2, a2, _ = svc.import_trade(td_b)
        db_session.commit()
        assert a2 == "created"
        assert t1.id != t2.id
