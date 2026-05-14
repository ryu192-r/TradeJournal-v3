"""CSV import endpoint."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import csv
import io

from app.db.database import get_db
from app.services.csv_import import CSVImportService

router = APIRouter(tags=["csv-import"])


# ─── CSV Template ───────────────────────────────────────────

CSV_HEADERS = [
    "symbol", "direction", "entry_price", "quantity", "entry_time",
    "exit_price", "exit_time", "fees", "setup", "tactic",
    "stop_price", "target_price", "r_multiple", "notes",
]

CSV_SAMPLE = [
    {
        "symbol": "RELIANCE",
        "direction": "LONG",
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
        "notes": "Followed my rules - good entry",
    },
]


@router.get("/api/v1/trades/csv-template")
def csv_template():
    """Download a CSV template for bulk trade imports."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_HEADERS)
    writer.writeheader()
    writer.writerow(CSV_SAMPLE[0])
    content = output.getvalue()

    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="trade_import_template.csv"',
        },
    )


# ─── CSV Import ─────────────────────────────────────────────

@router.post("/api/v1/trades/csv-import")
async def import_trades_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Import trades from a CSV file.

    Required columns: symbol, direction, entry_price, quantity, entry_time.
    Optional columns: exit_price, exit_time, fees, setup, tactic,
    stop_price, target_price, r_multiple, notes.

    Returns {status, added, skipped, total[, errors]}.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv file")

    content = (await file.read()).decode("utf-8")

    svc = CSVImportService(db)
    result = svc.import_csv(content)

    if result["status"] == "error":
        raise HTTPException(
            status_code=422,
            detail={
                "message": result["errors"][0],
                "errors": result["errors"],
            },
        )

    return {
        "message": f"Imported {result['added']} trades, skipped {result['skipped']} duplicates",
        "added": result["added"],
        "skipped": result["skipped"],
        "total": result["total"],
    }
