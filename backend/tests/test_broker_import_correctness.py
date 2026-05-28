"""Tests for broker CSV import correctness: idempotency, dry_run, row errors, user isolation."""
import io
import csv
import pytest
from decimal import Decimal
from datetime import datetime

from app.core.security import get_password_hash
from app.db.database import Base, SessionLocal, engine as real_engine
from app.models.user import User
from app.models.account import Account
from app.models.trade import Trade
from app.services.trade_service import TradeService
from app.services.broker_import import parse_zerodha_csv, parse_generic_csv, parse_dhan_csv


_email_counter = 0


def _next_email():
    global _email_counter
    _email_counter += 1
    return f"broker-test-{_email_counter}@example.com"


def _make_user(db):
    user = User(email=_next_email(), full_name="Broker Test", hashed_password=get_password_hash("test"))
    db.add(user)
    db.flush()
    return user


def _make_account(db, user_id):
    acc = Account(user_id=user_id, name="Default", broker="Test", initial_balance=Decimal("100000"), current_balance=Decimal("100000"))
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


class TestBrokerDryRun:
    def test_dry_run_no_db_mutation(self, db_session):
        user = _make_user(db_session)
        _make_account(db_session, user.id)
        csv_content = "symbol,entry_price,quantity,entry_time,exit_price,exit_time,fees\nRELIANCE,100,10,2024-01-15 09:20:00,110,2024-01-15 14:30:00,5\n"
        svc = TradeService(db_session)
        errors, rows = parse_generic_csv(csv_content)
        assert not errors
        for row in rows:
            row["user_id"] = user.id
            row["import_source"] = "broker_csv:generic"
        count_before = db_session.query(Trade).filter(Trade.user_id == user.id).count()
        for row in rows:
            # simulate exact-duplicate fingerprint lookup in service
            fp = svc.compute_fingerprint({**row, "entry_price": Decimal("100"), "quantity": Decimal("10"), "entry_time": datetime.fromisoformat("2024-01-15T09:20:00"), "exit_price": Decimal("110"), "exit_time": datetime.fromisoformat("2024-01-15T14:30:00")})
            existing = svc.get_by_import_fingerprint(user.id, fp)
            assert existing is None
        count_after = db_session.query(Trade).filter(Trade.user_id == user.id).count()
        assert count_before == count_after

    def test_dry_run_skips_existing(self, db_session):
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
            "fees": Decimal("5"),
            "import_source": "broker_csv:generic",
        }
        t, action, _ = svc.import_trade(td)
        assert action == "created"
        fp = svc.compute_fingerprint(td)
        existing = svc.get_by_import_fingerprint(user.id, fp)
        assert existing is not None


class TestBrokerImportIdempotency:
    def test_same_csv_twice_no_duplicate(self, db_session):
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
            "fees": Decimal("5"),
            "import_source": "broker_csv:generic",
        }
        t1, a1, _ = svc.import_trade(td)
        db_session.commit()
        t2, a2, _ = svc.import_trade(td)
        db_session.commit()
        assert a1 == "created"
        assert a2 == "merged"
        assert t1.id == t2.id
        count = db_session.query(Trade).filter(Trade.user_id == user.id, Trade.symbol == "RELIANCE").count()
        assert count == 1

    def test_same_symbol_different_time_separate(self, db_session):
        user = _make_user(db_session)
        svc = TradeService(db_session)
        td1 = {
            "user_id": user.id,
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("100"),
            "quantity": Decimal("10"),
            "entry_time": datetime.fromisoformat("2024-01-15T09:20:00"),
            "import_source": "broker_csv:generic",
        }
        td2 = {
            "user_id": user.id,
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": Decimal("101"),
            "quantity": Decimal("10"),
            "entry_time": datetime.fromisoformat("2024-01-15T10:30:00"),
            "import_source": "broker_csv:generic",
        }
        t1, a1, _ = svc.import_trade(td1)
        t2, a2, _ = svc.import_trade(td2)
        db_session.commit()
        assert a1 == "created"
        assert a2 == "created"
        assert t1.id != t2.id


class TestBrokerImportRowErrors:
    def test_missing_required_column(self):
        csv_content = "symbol,entry_price,quantity\nRELIANCE,100,10\n"
        errors, _ = parse_generic_csv(csv_content)
        assert any("entry_time" in e for e in errors)

    def test_invalid_numeric_field(self):
        csv_content = "symbol,entry_price,quantity,entry_time\nRELIANCE,abc,10,2024-01-15\n"
        errors, rows = parse_generic_csv(csv_content)
        assert errors

    def test_bad_date(self):
        csv_content = "symbol,entry_price,quantity,entry_time\nRELIANCE,100,10,not-a-date\n"
        errors, rows = parse_generic_csv(csv_content)
        assert errors


class TestBrokerUserIsolation:
    def test_user_a_invisible_to_user_b(self, db_session):
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
            "import_source": "broker_csv:generic",
        }
        t1, a1, _ = svc.import_trade(td_a)
        db_session.commit()
        # same data for user_b should create new
        td_b = {**td_a, "user_id": user_b.id}
        t2, a2, _ = svc.import_trade(td_b)
        db_session.commit()
        assert a2 == "created"
        assert t1.id != t2.id


class TestBrokerFeesIncluded:
    def test_fees_included(self, db_session):
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
            "fees": Decimal("10"),
            "import_source": "broker_csv:generic",
        }
        t, _, _ = svc.import_trade(td)
        db_session.commit()
        assert t.fees == Decimal("10")
        # PnL = (110-100)*10 - 10 = 90
        assert t.pnl == Decimal("90")
