"""CSV import service for bulk trade imports."""
import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import List, Dict, Tuple

from sqlalchemy.orm import Session

from app.models.trade import Trade


REQUIRED_COLUMNS = [
    "symbol", "direction", "entry_price", "quantity", "entry_time",
]

OPTIONAL_COLUMNS = [
    "exit_price", "exit_time", "fees", "setup", "tactic",
    "stop_price", "target_price", "r_multiple", "status", "notes",
]


def _to_datetime(s: str) -> datetime:
    s = s.strip()
    for fmt in [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d",
    ]:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse datetime: {s}")


def _to_decimal(s: str) -> Decimal:
    s = s.strip()
    if not s:
        return None
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


class CSVImportService:
    """Parse and import trades from CSV content."""

    def __init__(self, db: Session):
        self.db = db

    def parse_and_validate(
        self, content: str,
    ) -> Tuple[List[str], List[Dict[str, str]]]:
        """Parse CSV string and validate headers + rows.

        Returns (errors, valid_rows). If headers are missing,
        errors is non-empty and valid_rows is empty.
        """
        reader = csv.DictReader(io.StringIO(content))
        if not reader.fieldnames:
            return (["CSV file is empty or has no headers"], [])

        headers = [h.strip().lower() for h in reader.fieldnames]
        missing = [c for c in REQUIRED_COLUMNS if c not in headers]
        if missing:
            return ([f"Missing required columns: {', '.join(missing)}"], [])

        valid_rows: List[Dict[str, str]] = []
        errors: List[str] = []

        for i, row in enumerate(reader, start=2):
            normed = {k.strip().lower(): (v.strip() if v else "")
                      for k, v in row.items() if k}

            row_errors: List[str] = []
            for col in REQUIRED_COLUMNS:
                val = normed.get(col, "")
                if not val:
                    row_errors.append(f"Row {i}: '{col}' is required")

            if normed.get("direction", "").upper() not in ("LONG", "SHORT"):
                row_errors.append(
                    f"Row {i}: direction must be 'LONG' or 'SHORT'"
                )

            for numeric_col in ["entry_price", "quantity"]:
                try:
                    d = _to_decimal(normed.get(numeric_col, ""))
                    if d is None or d <= 0:
                        raise InvalidOperation()
                except InvalidOperation:
                    row_errors.append(
                        f"Row {i}: '{numeric_col}' must be a positive number"
                    )

            if row_errors:
                errors.extend(row_errors)
            else:
                valid_rows.append(normed)

        return (errors, valid_rows)

    def import_rows(self, rows: List[Dict[str, str]],) -> Dict[str, int]:
        """Import validated rows into DB. Returns summary dict."""
        added = 0
        skipped = 0

        for row in rows:
            symbol = row["symbol"].upper()
            try:
                entry_time = _to_datetime(row["entry_time"])
            except ValueError:
                skipped += 1
                continue

            existing = (
                self.db.query(Trade)
                .filter(
                    Trade.symbol == symbol,
                    Trade.entry_time == entry_time,
                )
                .first()
            )
            if existing:
                skipped += 1
                continue

            trade = Trade(
                symbol=symbol,
                direction=row["direction"].upper(),
                entry_price=_to_decimal(row["entry_price"]),
                quantity=_to_decimal(row["quantity"]),
                entry_time=entry_time,
                exit_price=_to_decimal(row["exit_price"])
                    if row.get("exit_price")
                    else None,
                exit_time=_to_datetime(row["exit_time"])
                    if row.get("exit_time")
                    else None,
                fees=_to_decimal(row.get("fees", "")) or Decimal("0"),
                setup=row.get("setup") or None,
                tactic=row.get("tactic") or None,
                stop_price=_to_decimal(row.get("stop_price", "")),
                target_price=_to_decimal(row.get("target_price", "")),
                r_multiple=_to_decimal(row.get("r_multiple", "")),
                status=row.get("status", "draft").lower() or "draft",
                notes=row.get("notes") or None,
            )
            trade.compute_pnl()
            self.db.add(trade)
            added += 1

        self.db.commit()
        return {"added": added, "skipped": skipped, "total": len(rows)}

    def import_csv(self, content: str) -> Dict[str, any]:
        """Full import pipeline: parse → validate → insert."""
        errors, valid_rows = self.parse_and_validate(content)
        if errors:
            return {
                "status": "error",
                "errors": errors,
                "added": 0,
                "skipped": 0,
                "total": 0,
            }
        result = self.import_rows(valid_rows)
        result["status"] = "success"
        return result
