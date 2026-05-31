#!/usr/bin/env python3
"""Audit trade session dates vs calendar buckets.

Usage (from repo root, with DATABASE_URL set):
  python scripts/audit_trade_dates.py
  python scripts/audit_trade_dates.py --month 2025-11
  python scripts/audit_trade_dates.py --user-id 1
"""

from __future__ import annotations

import argparse
import calendar as cal
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.db.database import SessionLocal
from app.models.trade import Trade
from app.utils.trade_dates import get_trade_session_date, weekday_from_session_date


def _parse_month(month: str) -> tuple[date, date]:
    year, mon = map(int, month.split("-"))
    start = date(year, mon, 1)
    end = date(year, mon, cal.monthrange(year, mon)[1])
    return start, end


def audit(user_id: int | None, month: str | None) -> int:
    db = SessionLocal()
    try:
        q = db.query(Trade).filter(Trade.status != "deleted")
        if user_id is not None:
            q = q.filter(Trade.user_id == user_id)
        trades = q.order_by(Trade.entry_time.asc()).all()

        print(f"Trades scanned: {len(trades)}")
        print("id\tsymbol\tentry_time\texit_time\tcreated_at\tsession_date\tweekday")
        mismatches = []

        for t in trades:
            session = get_trade_session_date(t)
            naive_date = t.entry_time.date() if t.entry_time else None
            wd = weekday_from_session_date(session) if session else None
            wd_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            print(
                f"{t.id}\t{t.symbol}\t"
                f"{t.entry_time.isoformat() if t.entry_time else '-'}\t"
                f"{t.exit_time.isoformat() if t.exit_time else '-'}\t"
                f"{t.created_at.isoformat() if t.created_at else '-'}\t"
                f"{session}\t{wd_names[wd] if wd is not None else '-'}"
            )
            if session and naive_date and session != naive_date:
                mismatches.append((t.id, naive_date, session))

        if mismatches:
            print("\n--- naive .date() != session_date (legacy UTC risk) ---")
            for tid, naive, session in mismatches:
                print(f"  trade {tid}: naive={naive} session={session}")

        if month:
            month_start, month_end = _parse_month(month)
            by_day: dict[date, list[Trade]] = defaultdict(list)
            for t in trades:
                s = get_trade_session_date(t)
                if s and month_start <= s <= month_end:
                    by_day[s].append(t)

            print(f"\n--- calendar buckets for {month} ---")
            for d in sorted(by_day):
                wd = weekday_from_session_date(d)
                print(f"  {d} ({['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][wd]}): {len(by_day[d])} trades")
                for t in by_day[d]:
                    print(f"    #{t.id} {t.symbol} entry={t.entry_time}")

        return 0
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit trade session dates")
    parser.add_argument("--user-id", type=int, default=None)
    parser.add_argument("--month", type=str, default=None, help="YYYY-MM")
    args = parser.parse_args()
    raise SystemExit(audit(args.user_id, args.month))


if __name__ == "__main__":
    main()
