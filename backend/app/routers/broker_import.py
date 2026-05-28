"""Broker import router — upload broker CSV files to import trades."""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
import io
import csv

from app.db.database import get_db
from app.models.trade import Trade
from app.models.account import Account
from app.models.trade_timeline import TradeTimeline
from app.services.capital_service import _reconcile_account
from app.services.setup_playbook_service import _update_setup_stats
from app.services.broker_import import BROKER_PARSERS, BROKER_DISPLAY, GENERIC_REQUIRED, parse_generic_csv
from app.services.import_normalization import normalize_import_row, parse_datetime, parse_decimal
from app.services.trade_service import TradeService
from app.core.dependencies import get_current_user
from app.models.user import User
from datetime import datetime
from decimal import Decimal

logger = logging.getLogger(__name__)

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
            "status": "open",
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
            "Date": "15/01/24",
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown broker '{broker}'. Supported: {list(BROKER_DISPLAY.keys())}",
        )

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
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
    dry_run: bool = Query(False, description="Preview rows without importing"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload broker CSV. Returns {status, added, skipped, updated, errors, total, preview, warnings}."""
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
            "skipped": 0,
            "updated": 0,
            "errors": errors,
            "total": 0,
            "preview": [],
            "warnings": [],
        }

    svc = TradeService(db)
    added = 0
    skipped = 0
    updated = 0
    row_errors: List[Dict[str, Any]] = []
    preview_rows: List[Dict[str, Any]] = []
    setups_seen = set()
    warnings: List[str] = []

    for i, row in enumerate(rows, start=2):
        # Inject identity
        row.setdefault("user_id", current_user.id)
        row.setdefault("import_source", f"broker_csv:{broker}")

        preview_row = {
            "symbol": row.get("symbol", ""),
            "entry_price": row.get("entry_price", ""),
            "quantity": row.get("quantity", ""),
            "_dry_run": dry_run,
        }

        # Validate/normalize
        try:
            trade_data = normalize_import_row(row)
        except ValueError as e:
            row_errors.append({"row": i, "reason": str(e)})
            preview_row["_error"] = str(e)
            preview_rows.append(preview_row)
            continue

        if dry_run:
            decision = svc.preview_import_decision(trade_data)
            if decision == "skipped":
                preview_row["_skipped"] = True
                skipped += 1
            else:
                preview_row["_skipped"] = False
            preview_rows.append(preview_row)
            continue

        # Import with deferred commit
        try:
            trade, action, info = svc.import_trade(trade_data, defer_commit=True)
        except Exception as e:
            logger.warning("import_row_failed", row=i, error=str(e), user_id=current_user.id)
            row_errors.append({"row": i, "reason": str(e)})
            preview_row["_error"] = str(e)
            preview_rows.append(preview_row)
            continue

        if action == "created":
            added += 1
            tl = TradeTimeline(
                trade_id=trade.id,
                event_type="trade_imported",
                note=f"Imported from {broker}",
            )
            db.add(tl)
        elif action == "merged":
            skipped += 1
            preview_row["_skipped"] = True
        elif action == "updated":
            updated += 1
            warnings.append(f"Row {i}: existing trade updated (external_order_id match)")
        else:
            skipped += 1

        if trade and trade.setup:
            setups_seen.add(trade.setup)
        preview_rows.append(preview_row)

    if dry_run:
        return {
            "status": "preview",
            "added": 0,
            "skipped": skipped,
            "updated": 0,
            "errors": errors,
            "total": len(rows),
            "preview": preview_rows[:50],
            "warnings": [],
        }

    # Post-import side effects — single atomic commit for all rows + side effects
    try:
        for setup_name in setups_seen:
            _update_setup_stats(db, setup_name, user_id=current_user.id)

        if added or updated:
            db.commit()
            account = db.query(Account).filter(Account.user_id == current_user.id).first()
            if account:
                _reconcile_account(account.id, db, user_id=current_user.id)
                db.commit()
    except Exception as e:
        logger.warning("broker_import_side_effects_failed", user_id=current_user.id, error=str(e))
        db.rollback()
        return {
            "status": "error",
            "added": added,
            "skipped": skipped,
            "updated": updated,
            "errors": [{"row": "side_effects", "reason": str(e)}],
            "total": len(rows),
            "preview": preview_rows[:50],
            "warnings": warnings,
        }

    logger.info(
        "broker_import_completed",
        user_id=current_user.id,
        broker=broker,
        added=added,
        skipped=skipped,
        updated=updated,
        errors=len(row_errors),
    )

    return {
        "status": "success" if not row_errors else "partial_errors",
        "added": added,
        "skipped": skipped,
        "updated": updated,
        "errors": row_errors,
        "total": len(rows),
        "preview": preview_rows[:50],
        "warnings": warnings,
    }
