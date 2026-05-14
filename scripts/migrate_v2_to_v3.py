#!/usr/bin/env python3
"""
Trading Journal v2 SQLite → v3 PostgreSQL Migration Script

Reads v2 SQLite database and migrates all data to v3 PostgreSQL schema.
Idempotent: safe to run multiple times. Uses INSERT ... ON CONFLICT DO NOTHING.

What migrates:
  - trades (v2) → trades (v3)
  - capital_events (v2) → capital_events (v3)
  - setup_types (v2) → setup_playbook (v3)
  - milestone_goals (v2) → milestones (v3)
  - stop_history (v2) → stop_history (v3)

Usage:
  python migrate_v2_to_v3.py --sqlite-path /path/to/trading.db --pg-url postgresql://user:pass@host:port/db

Environment variables (fallbacks if CLI args not provided):
  V2_SQLITE_PATH  — path to v2 SQLite database
  V3_PG_URL       — PostgreSQL connection string
"""

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, date
from decimal import Decimal
from typing import Any

import structlog

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# v3 PostgreSQL DDL — mirrors the models from t_84f190cd/src/models/
# ---------------------------------------------------------------------------

V3_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS trades (
    id              INTEGER PRIMARY KEY,
    symbol          VARCHAR(20) NOT NULL,
    direction       VARCHAR(10) NOT NULL,
    entry_price     NUMERIC(18, 8) NOT NULL,
    exit_price      NUMERIC(18, 8),
    quantity        NUMERIC(18, 8) NOT NULL,
    entry_time      TIMESTAMP NOT NULL,
    exit_time       TIMESTAMP,
    fees            NUMERIC(18, 8) DEFAULT 0,
    pnl             NUMERIC(18, 8),
    notes           TEXT,
    tags            VARCHAR(200),
    setup           VARCHAR(100),
    tactic          VARCHAR(100),
    stop_price      NUMERIC(18, 8),
    target_price    NUMERIC(18, 8),
    r_multiple      NUMERIC(10, 4),
    status          VARCHAR(20) DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS capital_events (
    id              INTEGER PRIMARY KEY,
    event_type      VARCHAR(50) NOT NULL,
    amount          NUMERIC(18, 8) NOT NULL,
    timestamp       TIMESTAMP NOT NULL,
    description     VARCHAR(200),
    trade_id        INTEGER REFERENCES trades(id)
);

CREATE TABLE IF NOT EXISTS setup_playbook (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    tactics         TEXT,
    ideal_conditions TEXT,
    risk_profile    TEXT,
    created_at      TIMESTAMP,
    updated_at      TIMESTAMP
);

CREATE TABLE IF NOT EXISTS milestones (
    id              INTEGER PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    target_date     DATE,
    target_amount   NUMERIC(18, 8),
    achieved        BOOLEAN DEFAULT FALSE,
    achieved_date   DATE,
    notes           VARCHAR(500),
    created_at      TIMESTAMP,
    updated_at      TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stop_history (
    id              INTEGER PRIMARY KEY,
    trade_id        INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    stop_type       VARCHAR(20) NOT NULL,
    price           NUMERIC(18, 8) NOT NULL,
    timestamp       TIMESTAMP NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS ix_trades_symbol ON trades (symbol);
CREATE INDEX IF NOT EXISTS ix_trades_status ON trades (status);
CREATE INDEX IF NOT EXISTS ix_trades_entry_time ON trades (entry_time);
CREATE INDEX IF NOT EXISTS ix_trades_symbol_status ON trades (symbol, status);
CREATE INDEX IF NOT EXISTS ix_trades_entry_time_exit_time ON trades (entry_time, exit_time);
CREATE INDEX IF NOT EXISTS ix_capital_events_timestamp ON capital_events (timestamp);
CREATE INDEX IF NOT EXISTS ix_stop_history_trade_id ON stop_history (trade_id);
"""


def _parse_datetime(date_str: str | None, time_str: str | None = None) -> datetime | None:
    """Parse v2 date and optional time strings into a datetime object.

    v2 stores entry_date as 'YYYY-MM-DD' and entry_time as 'HH:MM' (or 'HH:MM:SS').
    v3 uses a single TIMESTAMP column.
    """
    if not date_str:
        return None

    date_part = date_str.strip()
    time_part = (time_str or "").strip()

    if time_part:
        # Handle both 'HH:MM' and 'HH:MM:SS' formats
        parts = time_part.split(":")
        if len(parts) == 2:
            time_part = f"{time_part}:00"
        try:
            return datetime.strptime(f"{date_part} {time_part}", "%Y-%m-%d %H:%M:%S")
        except ValueError:
            # Fall back to date only
            pass

    try:
        return datetime.strptime(date_part, "%Y-%m-%d")
    except ValueError:
        return None


def _status_v2_to_v3(v2_status: str) -> str:
    """Map v2 trade status to v3 trade status.

    v2: open, closed, merged
    v3: draft, reviewed, analytics
    """
    mapping = {
        "open": "draft",
        "closed": "reviewed",
        "merged": "reviewed",
    }
    return mapping.get(v2_status, "draft")


def _direction_v2_to_v3(v2_side: str) -> str:
    """Map v2 side to v3 direction (uppercase)."""
    return (v2_side or "long").upper()


# ---------------------------------------------------------------------------
# SQLite readers
# ---------------------------------------------------------------------------

def read_sqlite_counts(sqlite_path: str) -> dict[str, int]:
    """Count rows in all v2 tables that we migrate."""
    counts = {}
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        for table in ["trades", "capital_events", "setup_types", "milestone_goals", "stop_history"]:
            try:
                row = conn.execute(f"SELECT COUNT(*) as cnt FROM {table}").fetchone()
                counts[table] = row["cnt"] if row else 0
            except sqlite3.OperationalError:
                counts[table] = 0
    finally:
        conn.close()
    return counts


def read_trades(sqlite_path: str) -> list[dict[str, Any]]:
    """Read all trades from v2 SQLite."""
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("SELECT * FROM trades ORDER BY id").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def read_capital_events(sqlite_path: str) -> list[dict[str, Any]]:
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("SELECT * FROM capital_events ORDER BY id").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def read_setup_types(sqlite_path: str) -> list[dict[str, Any]]:
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("SELECT * FROM setup_types ORDER BY sort_order, code").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def read_milestone_goals(sqlite_path: str) -> list[dict[str, Any]]:
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("SELECT * FROM milestone_goals ORDER BY sort_order, id").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def read_stop_history(sqlite_path: str) -> list[dict[str, Any]]:
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("SELECT * FROM stop_history ORDER BY id").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# PostgreSQL writer
# ---------------------------------------------------------------------------

def ensure_schema(pg_conn) -> None:
    """Create v3 tables if they don't exist."""
    with pg_conn.cursor() as cur:
        cur.execute(V3_SCHEMA_SQL)
    pg_conn.commit()
    logger.info("v3 schema ensured")


def migrate_trades(pg_conn, trades: list[dict]) -> int:
    """Insert v2 trades into v3. Returns count of rows inserted."""
    inserted = 0
    with pg_conn.cursor() as cur:
        for t in trades:
            entry_time = _parse_datetime(t.get("entry_date"), t.get("entry_time"))
            exit_time = _parse_datetime(t.get("exit_date"), t.get("exit_time"))

            # Compose notes: keep original + append emotion info if present
            notes = t.get("notes") or ""
            emotion_type = t.get("emotion_entry_type")
            emotion_reason = t.get("emotion_entry_reason")
            if emotion_type:
                notes = f"{notes}\n[Emotion: {emotion_type}]" if notes else f"[Emotion: {emotion_type}]"
            if emotion_reason:
                notes = f"{notes} {emotion_reason}" if notes else emotion_reason
            notes = notes.strip() or None

            cur.execute(
                """
                INSERT INTO trades (
                    id, symbol, direction, entry_price, exit_price, quantity,
                    entry_time, exit_time, fees, pnl, notes, tags, setup, tactic,
                    stop_price, target_price, r_multiple, status
                ) VALUES (
                    %(id)s, %(symbol)s, %(direction)s, %(entry_price)s, %(exit_price)s,
                    %(quantity)s, %(entry_time)s, %(exit_time)s, %(fees)s, %(pnl)s,
                    %(notes)s, %(tags)s, %(setup)s, %(tactic)s, %(stop_price)s,
                    %(target_price)s, %(r_multiple)s, %(status)s
                )
                ON CONFLICT (id) DO NOTHING
                """,
                {
                    "id": t["id"],
                    "symbol": t.get("stock", "").upper(),
                    "direction": _direction_v2_to_v3(t.get("side")),
                    "entry_price": t.get("entry_price"),
                    "exit_price": t.get("exit_price"),
                    "quantity": t.get("shares"),
                    "entry_time": entry_time,
                    "exit_time": exit_time,
                    "fees": Decimal("0"),  # v2 didn't track fees separately
                    "pnl": t.get("pnl"),
                    "notes": notes,
                    "tags": None,  # v2 didn't have a separate tags field; emotion data moved to notes
                    "setup": t.get("setup_type"),
                    "tactic": t.get("entry_tactic"),
                    "stop_price": t.get("stop_loss"),
                    "target_price": t.get("target"),
                    "r_multiple": t.get("r_multiple"),
                    "status": _status_v2_to_v3(t.get("status")),
                },
            )
            if cur.rowcount > 0:
                inserted += 1
    pg_conn.commit()
    return inserted


def migrate_capital_events(pg_conn, events: list[dict]) -> int:
    """Insert v2 capital_events into v3. Returns count of rows inserted."""
    inserted = 0
    with pg_conn.cursor() as cur:
        for e in events:
            # v2 stores date as DATE, v3 uses TIMESTAMP
            ts = _parse_datetime(e.get("date"))
            cur.execute(
                """
                INSERT INTO capital_events (id, event_type, amount, timestamp, description, trade_id)
                VALUES (%(id)s, %(event_type)s, %(amount)s, %(timestamp)s, %(description)s, %(trade_id)s)
                ON CONFLICT (id) DO NOTHING
                """,
                {
                    "id": e["id"],
                    "event_type": e.get("type"),
                    "amount": e.get("amount"),
                    "timestamp": ts,
                    "description": e.get("note"),
                    "trade_id": None,  # v2 didn't link capital events to trades
                },
            )
            if cur.rowcount > 0:
                inserted += 1
    pg_conn.commit()
    return inserted


def migrate_setup_types(pg_conn, setups: list[dict]) -> int:
    """Insert v2 setup_types into v3 setup_playbook. Returns count of rows inserted."""
    inserted = 0
    with pg_conn.cursor() as cur:
        for idx, s in enumerate(setups, start=1):
            rules_json = s.get("rules_json")
            # Parse rules_json into structured fields
            tactics = None
            ideal_conditions = None
            risk_profile = None
            if rules_json:
                try:
                    rules = json.loads(rules_json)
                    tactics = json.dumps({"entry": rules.get("entry")})
                    ideal_conditions = json.dumps({
                        "stop": rules.get("stop"),
                        "target": rules.get("target"),
                    })
                    risk_profile = json.dumps({"max_risk": rules.get("max_risk")})
                except (json.JSONDecodeError, TypeError):
                    tactics = rules_json  # Store raw if not valid JSON

            cur.execute(
                """
                INSERT INTO setup_playbook (id, name, description, tactics, ideal_conditions, risk_profile, created_at, updated_at)
                VALUES (%(id)s, %(name)s, %(description)s, %(tactics)s, %(ideal_conditions)s, %(risk_profile)s, %(created_at)s, %(updated_at)s)
                ON CONFLICT (name) DO NOTHING
                """,
                {
                    "id": idx,
                    "name": s.get("name") or s.get("code"),
                    "description": s.get("description") or None,
                    "tactics": tactics,
                    "ideal_conditions": ideal_conditions,
                    "risk_profile": risk_profile,
                    "created_at": _parse_datetime(s.get("created_at")),
                    "updated_at": _parse_datetime(s.get("created_at")),
                },
            )
            if cur.rowcount > 0:
                inserted += 1
    pg_conn.commit()
    return inserted


def migrate_milestone_goals(pg_conn, milestones: list[dict]) -> int:
    """Insert v2 milestone_goals into v3 milestones. Returns count of rows inserted."""
    inserted = 0
    with pg_conn.cursor() as cur:
        for m in milestones:
            cur.execute(
                """
                INSERT INTO milestones (id, name, target_date, target_amount, achieved, achieved_date, notes, created_at, updated_at)
                VALUES (%(id)s, %(name)s, %(target_date)s, %(target_amount)s, %(achieved)s, %(achieved_date)s, %(notes)s, %(created_at)s, %(updated_at)s)
                ON CONFLICT (id) DO NOTHING
                """,
                {
                    "id": m["id"],
                    "name": m.get("name"),
                    "target_date": None,  # v2 milestones didn't have target dates
                    "target_amount": m.get("target_amount"),
                    "achieved": False,
                    "achieved_date": None,
                    "notes": m.get("color"),  # Store color in notes since v3 doesn't have a color column
                    "created_at": _parse_datetime(m.get("created_at")),
                    "updated_at": _parse_datetime(m.get("created_at")),
                },
            )
            if cur.rowcount > 0:
                inserted += 1
    pg_conn.commit()
    return inserted


def migrate_stop_history(pg_conn, stops: list[dict]) -> int:
    """Insert v2 stop_history into v3. Returns count of rows inserted."""
    inserted = 0
    with pg_conn.cursor() as cur:
        for s in stops:
            ts = _parse_datetime(s.get("date"))
            cur.execute(
                """
                INSERT INTO stop_history (id, trade_id, stop_type, price, timestamp)
                VALUES (%(id)s, %(trade_id)s, %(stop_type)s, %(price)s, %(timestamp)s)
                ON CONFLICT (id) DO NOTHING
                """,
                {
                    "id": s["id"],
                    "trade_id": s.get("trade_id"),
                    "stop_type": s.get("type"),
                    "price": s.get("price"),
                    "timestamp": ts,
                },
            )
            if cur.rowcount > 0:
                inserted += 1
    pg_conn.commit()
    return inserted


def read_pg_counts(pg_conn) -> dict[str, int]:
    """Count rows in all v3 tables."""
    counts = {}
    with pg_conn.cursor() as cur:
        for table in ["trades", "capital_events", "setup_playbook", "milestones", "stop_history"]:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            counts[table] = cur.fetchone()[0]
    return counts


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate Trading Journal v2 SQLite to v3 PostgreSQL")
    parser.add_argument(
        "--sqlite-path",
        default=os.environ.get("V2_SQLITE_PATH", "/root/Trading Journal v2/data/trading.db"),
        help="Path to v2 SQLite database",
    )
    parser.add_argument(
        "--pg-url",
        default=os.environ.get("V3_PG_URL", ""),
        help="PostgreSQL connection URL (e.g. postgresql://user:pass@host:port/dbname)",
    )
    parser.add_argument(
        "--pg-host",
        default="localhost",
        help="PostgreSQL host",
    )
    parser.add_argument(
        "--pg-port",
        default="5432",
        help="PostgreSQL port",
    )
    parser.add_argument(
        "--pg-database",
        default="trading_journal_v3",
        help="PostgreSQL database name",
    )
    parser.add_argument(
        "--pg-user",
        default="tjuser",
        help="PostgreSQL user",
    )
    parser.add_argument(
        "--pg-password",
        default="",
        help="PostgreSQL password (empty for trust auth)",
    )
    args = parser.parse_args()

    # Build connection params
    if args.pg_url:
        database_url = args.pg_url
    else:
        password_part = f":{args.pg_password}" if args.pg_password else ""
        database_url = f"postgresql://{args.pg_user}{password_part}@{args.pg_host}:{args.pg_port}/{args.pg_database}"

    # Validate SQLite path
    if not os.path.isfile(args.sqlite_path):
        logger.error("SQLite database not found", path=args.sqlite_path)
        return 1

    # Step 1: Read source counts
    logger.info("Reading v2 SQLite data", path=args.sqlite_path)
    sqlite_counts = read_sqlite_counts(args.sqlite_path)
    logger.info("v2 SQLite row counts", **sqlite_counts)

    # Step 2: Connect to PostgreSQL
    import psycopg2
    try:
        pg_conn = psycopg2.connect(database_url)
        pg_conn.autocommit = False
        logger.info("Connected to PostgreSQL", url=database_url.replace(args.pg_password, "***") if args.pg_password else database_url)
    except Exception as e:
        logger.error("Failed to connect to PostgreSQL", error=str(e))
        return 1

    try:
        # Step 3: Ensure schema exists
        ensure_schema(pg_conn)

        # Pre-migration PG counts
        pg_counts_before = read_pg_counts(pg_conn)
        logger.info("v3 PostgreSQL row counts BEFORE migration", **pg_counts_before)

        # Step 4: Migrate each table
        # -- Trades
        trades = read_trades(args.sqlite_path)
        n = migrate_trades(pg_conn, trades)
        logger.info("Migrated trades", source=len(trades), inserted=n)

        # -- Capital Events
        events = read_capital_events(args.sqlite_path)
        n = migrate_capital_events(pg_conn, events)
        logger.info("Migrated capital_events", source=len(events), inserted=n)

        # -- Setup Types -> Setup Playbook
        setups = read_setup_types(args.sqlite_path)
        n = migrate_setup_types(pg_conn, setups)
        logger.info("Migrated setup_types -> setup_playbook", source=len(setups), inserted=n)

        # -- Milestone Goals -> Milestones
        milestones = read_milestone_goals(args.sqlite_path)
        n = migrate_milestone_goals(pg_conn, milestones)
        logger.info("Migrated milestone_goals -> milestones", source=len(milestones), inserted=n)

        # -- Stop History
        stops = read_stop_history(args.sqlite_path)
        n = migrate_stop_history(pg_conn, stops)
        logger.info("Migrated stop_history", source=len(stops), inserted=n)

        # Step 5: Validate counts
        pg_counts_after = read_pg_counts(pg_conn)
        logger.info("v3 PostgreSQL row counts AFTER migration", **pg_counts_after)

        # Validation summary
        v2_to_v3_map = {
            "trades": "trades",
            "capital_events": "capital_events",
            "setup_types": "setup_playbook",
            "milestone_goals": "milestones",
            "stop_history": "stop_history",
        }

        all_valid = True
        print("\n" + "=" * 60)
        print("MIGRATION VALIDATION")
        print("=" * 60)
        print(f"{'v2 Table':<20} {'v3 Table':<20} {'v2 Count':>10} {'v3 Count':>10} {'Status':>10}")
        print("-" * 60)

        for v2_table, v3_table in v2_to_v3_map.items():
            v2_cnt = sqlite_counts.get(v2_table, 0)
            v3_cnt = pg_counts_after.get(v3_table, 0)
            # v3 count can be >= v2 count if script is re-run (idempotent)
            status = "OK" if v3_cnt >= v2_cnt else "MISMATCH"
            if status == "MISMATCH":
                all_valid = False
            print(f"{v2_table:<20} {v3_table:<20} {v2_cnt:>10} {v3_cnt:>10} {status:>10}")

        print("=" * 60)
        if all_valid:
            print("RESULT: ALL COUNTS VALID — Migration successful!")
        else:
            print("RESULT: COUNT MISMATCH — Data loss detected!")
        print()

        # Print field mapping notes
        print("FIELD MAPPING NOTES:")
        print("  trades.stock        -> trades.symbol (uppercased)")
        print("  trades.side         -> trades.direction (LONG/SHORT)")
        print("  trades.entry_date+  -> trades.entry_time (combined DateTime)")
        print("    entry_time")
        print("  trades.exit_date+   -> trades.exit_time (combined DateTime)")
        print("    exit_time")
        print("  trades.shares       -> trades.quantity")
        print("  trades.stop_loss    -> trades.stop_price")
        print("  trades.target       -> trades.target_price")
        print("  trades.setup_type   -> trades.setup")
        print("  trades.entry_tactic -> trades.tactic")
        print("  trades.status       -> trades.status (open->draft, closed->reviewed)")
        print("  trades.emotion_*    -> trades.notes (appended)")
        print("  capital_events.date -> capital_events.timestamp (DATE->DateTime)")
        print("  capital_events.note -> capital_events.description")
        print("  capital_events.type -> capital_events.event_type")
        print("  setup_types.rules   -> setup_playbook.tactics/ideal_conditions/risk_profile (parsed JSON)")
        print("  milestone_goals.color -> milestones.notes (preserved in notes)")
        print("  stop_history.type   -> stop_history.stop_type")
        print("  stop_history.date   -> stop_history.timestamp (DATE->DateTime)")
        print()

        if not all_valid:
            return 1

        return 0

    except Exception as e:
        logger.error("Migration failed", error=str(e), exc_info=True)
        pg_conn.rollback()
        return 1
    finally:
        pg_conn.close()


if __name__ == "__main__":
    sys.exit(main())