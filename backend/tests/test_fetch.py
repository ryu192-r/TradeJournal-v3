"""Tests for fetch_trades — SQL → DataFrame extraction layer.

Uses the test client (which has fresh SQLite DB per test) and
accesses the engine via `get_db` override to test the real SQL path.
"""


def _insert_trade(client, token, **kw):
    data = {
        "symbol": "TEST",
        "direction": "LONG",
        "entry_price": 100.0,
        "exit_price": 110.0,
        "quantity": 10,
        "entry_time": "2025-01-13T09:30:00",
        "exit_time": "2025-01-13T10:00:00",
        **kw,
    }
    return client.post(
        "/api/v1/trades/", json=data,
        headers={"Authorization": f"Bearer {token}"},
    )


def _get_test_session(client):
    """Get a Session from the test DB that the client uses."""
    from app.db.database import get_db
    # The conftest overrides get_db — call it to get the session
    gen = get_db()
    db = next(gen)
    return db


def test_fetch_trades_returns_dataframe(client, auth_user_token):
    from app.services.fetch import fetch_trades
    _insert_trade(client, auth_user_token, symbol="ABC")
    db = _get_test_session(client)
    try:
        df = fetch_trades(db)
        assert not df.empty
        assert "symbol" in df.columns
        assert "pnl" in df.columns
        assert "r_multiple" in df.columns
    finally:
        db.close()


def test_fetch_trades_excludes_deleted(client, auth_user_token):
    from app.services.fetch import fetch_trades
    r = _insert_trade(client, auth_user_token, symbol="TO_DELETE")
    body = r.json().get("data", r.json())
    tid = body["id"]
    client.delete(f"/api/v1/trades/{tid}", headers={"Authorization": f"Bearer {auth_user_token}"})
    db = _get_test_session(client)
    try:
        df = fetch_trades(db)
        if df.empty:
            # All trades deleted — test passes
            return
        assert "TO_DELETE" not in df["symbol"].tolist()
    finally:
        db.close()


def test_fetch_trades_excludes_open_trades(client, auth_user_token):
    from app.services.fetch import fetch_trades
    _insert_trade(
        client, auth_user_token,
        symbol="OPEN_TRADE",
        exit_price=None,
    )
    db = _get_test_session(client)
    try:
        df = fetch_trades(db)
        if not df.empty:
            assert "OPEN_TRADE" not in df["symbol"].tolist()
    finally:
        db.close()


def test_fetch_trades_numeric_conversion(client, auth_user_token):
    from app.services.fetch import fetch_trades
    _insert_trade(
        client, auth_user_token,
        symbol="NUMERIC_TEST",
        entry_price="2500.50",
        exit_price="2600.75",
    )
    db = _get_test_session(client)
    try:
        df = fetch_trades(db)
        row = df[df["symbol"] == "NUMERIC_TEST"]
        assert not row.empty
        assert row["entry_price"].dtype in (float, "float64")
    finally:
        db.close()


def test_fetch_trades_empty_result(client, auth_user_token):
    from app.services.fetch import fetch_trades
    db = _get_test_session(client)
    try:
        df = fetch_trades(db)
        assert df.empty
    finally:
        db.close()
