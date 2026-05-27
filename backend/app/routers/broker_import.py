"""Broker import router — upload broker CSV files to import trades."""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import io
import csv

from app.db.database import get_db
from app.models.trade import Trade
from app.models.account import Account
from app.services.capital_service import _reconcile_account
from app.services.setup_playbook_service import _update_setup_stats
from app.services.broker_import import BROKER_PARSERS, BROKER_DISPLAY, GENERIC_REQUIRED
from app.services.trade_service import TradeService
from datetime import datetime
from decimal import Decimal
from app.core.dependencies import get_current_user


router = APIRouter(dependencies=[Depends(get_current_user)], )


# ─── Supported brokers ─────────────────────────────────────

@router.get("/brokers")
def list_brokers():
    """Return list of supported brokers for import."""
    return {
        "brokers": [
            {"id": k, "name": v}
            for k, v in BROKER_DISPLAY.items()
        ]
    }


# ─── Download template ─────────────────────────────────────

@router.get("/import/template/{broker}")
def download_template(broker: str):
    """Download a CSV template for the given broker."""
    if broker == "generic":
        headers = [
            "symbol", "entry_price", "quantity", "entry_time",
            "exit_price", "exit_time", "fees", "setup", "tactic",
            "stop_price", "target_price", "r_multiple", "status", "notes",
        ]
        sample = {
            "symbol": "RELIANCE",
            "entry_price": "2650.50",
            "quantity": "50",
            "entry_time": "2024-01-15 09:20:00",
            "exit_price": "2680.00",
            "exit_time": "2024-01-15 14:30:00",
            "fees": "2.50",
            "setup": "EMA Crossover",
            "tactic": "Swing",
            "stop_price": "2620",
            "target_price": "2750",
            "r_multiple": "1.5",
            "status": "draft",
            "notes": "Followed my rules - good entry",
        }
    elif broker == "zerodha":
        headers = [
            "Symbol", "Buy Qty", "Buy Rate", "Sell Qty",
            "Sell Rate", "Buy Date", "Sell Date", "P&L", "Brokerage",
        ]
        sample = {
            "Symbol": "RELIANCE",
            "Buy Qty": "50",
            "Buy Rate": "2650.50",
            "Sell Qty": "50",
            "Sell Rate": "2680.00",
            "Buy Date": "2024-01-15 09:20:00",
            "Sell Date": "2024-01-15 14:30:00",
            "P&L": "1475.00",
            "Brokerage": "2.50",
        }
    elif broker == "dhan":
        headers = [
            "Date", "Time", "Name", "Buy/Sell", "Order",
            "Exchange", "Segment", "Quantity/Lot", "Trade Price",
            "Trade Value", "Status",
        ]
        sample = {
            "Date": "13/05/26",
            "Time": "09:20:30",
            "Name": "RELIANCE",
            "Buy/Sell": "BUY",
            "Order": "INTRADAY",
            "Exchange": "NSE",
            "Segment": "Equity",
            "Quantity/Lot": "50",
            "Trade Price": "2650.50",
            "Trade Value": "132525.00",
            "Status": "Traded",
        }
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown broker '{broker}'. Supported: {list(BROKER_DISPLAY.keys())}")

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writerow(sample)
    content = output.getvalue()

    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{broker}_import_template.csv"',
        },
    )


# ─── Import (upload) ───────────────────────────────────────

@router.post("/import")
async def import_broker_csv(
    broker: str = Query(..., description="Broker id: zerodha, dhan, or generic"),
    file: UploadFile = File(...),
    dry_run: bool = Query(False, description="If true, preview which rows would be skipped without importing"),
    db: Session = Depends(get_db),
):
    """Upload a broker CSV and import trades.

    Returns {status, added, skipped, total, errors, preview}.
    """
    if broker not in BROKER_PARSERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown broker '{broker}'. Supported: {list(BROKER_DISPLAY.keys())}",
        )

    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file uploaded")

    content_bytes = await file.read()
    try:
        content = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        try:
            content = content_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            content = content_bytes.decode("latin-1")

    parser = BROKER_PARSERS[broker]
    errors, rows = parser(content)

    if errors and not rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": errors[0], "errors": errors},
        )

    if not rows:
        return {
            "status": "success",
            "added": 0,
            "merged": 0,
            "total": 0,
            "errors": errors,
            "preview": [],
        }

    from app.services.trade_service import TradeService
    from sqlalchemy import func

    svc = TradeService(db)

    # Dry-run mode: preview which rows would be skipped without importing
    if dry_run:
        preview_rows = []
        skipped = 0
        for row in rows:
            symbol = row.get("symbol", "").upper()[:20]
            entry_time_str = row.get("entry_time", "")
            entry_time = _parse_dt(entry_time_str) if entry_time_str else None
            is_skipped = False
            if symbol and entry_time:
                existing = (
                    db.query(Trade)
                    .filter(Trade.symbol == symbol, func.date(Trade.entry_time) == entry_time.date(), Trade.status != "deleted")
                    .first()
                )
                if existing:
                    is_skipped = True
                    skipped += 1
            preview_rows.append({
                "symbol": symbol or row.get("symbol", ""),
                "entry_price": row.get("entry_price", ""),
                "quantity": row.get("quantity", ""),
                "_skipped": is_skipped,
            })
        return {
            "status": "success",
            "added": 0,
            "skipped": skipped,
            "total": len(rows),
            "errors": errors,
            "preview": preview_rows[:50],
        }

    # Actual import
    added = 0
    merged = 0
    setups_seen = set()
    for row in rows:
        symbol = row.get("symbol", "").upper()[:20]
        if not symbol:
            continue

        try:
            entry_time_str = row.get("entry_time", "")
            entry_time = _parse_dt(entry_time_str) if entry_time_str else None
            if not entry_time:
                continue
        except ValueError:
            continue

        direction = "LONG"

        entry_price = _parse_decimal(row.get("entry_price", "")) or Decimal("0")
        quantity = _parse_decimal(row.get("quantity", "")) or Decimal("0")
        if entry_price <= 0 or quantity <= 0:
            continue

        exit_price = _parse_decimal(row.get("exit_price", ""))
        exit_time_str = row.get("exit_time", "")
        exit_time = _parse_dt(exit_time_str) if exit_time_str else None
        fees = _parse_decimal(row.get("fees", "")) or Decimal("0")

        trade_data = {
            "symbol": symbol,
            "direction": direction,
            "entry_price": entry_price,
            "quantity": quantity,
            "entry_time": entry_time,
            "exit_price": exit_price,
            "exit_time": exit_time,
            "fees": fees,
            "stop_price": _parse_decimal(row.get("stop_price", "")),
            "target_price": _parse_decimal(row.get("target_price", "")),
            "setup": row.get("setup") or None,
            "tactic": row.get("tactic") or None,
            "notes": row.get("notes") or None,
        }

        trade, action = svc.merge_or_create(trade_data)
        if action == "merged":
            merged += 1
        else:
            added += 1
        if trade.setup:
            setups_seen.add(trade.setup)

    for setup_name in setups_seen:
        _update_setup_stats(db, setup_name)

    db.commit()
    account = db.query(Account).first()
    if account:
        _reconcile_account(account.id, db)

    return {
        "status": "success",
        "added": added,
        "merged": merged,
        "total": len(rows),
        "errors": errors,
        "preview": preview,
    }


def _parse_dt(s: str):
    if not s:
        return None
    for fmt in [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%d-%m-%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%d-%m-%Y %H:%M",
        "%d/%m/%Y %H:%M",
        "%d-%m-%Y",
        "%d/%m/%Y",
    ]:
        try:
            return datetime.strptime(s.strip(), fmt)
        except ValueError:
            continue
    return None


def _parse_decimal(s):
    if not s:
        return None
    s = s.strip().replace(",", "")
    try:
        return Decimal(s)
    except Exception:
        return None
