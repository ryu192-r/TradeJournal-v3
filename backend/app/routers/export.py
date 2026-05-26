"""Export endpoints for CSV downloads and Telegram backups."""

from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
import io

from app.services.export_service import ExportService
from app.db.database import get_db
from app.core.config import settings
from app.core.dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/export", tags=["export"])


@router.get("/csv")
async def export_csv(
    from_date: str = None,
    to_date: str = None,
    trade_status: str = None,
    db: Session = Depends(get_db)
):
    """Export trades as CSV file.
    
    Query params:
    - from_date: ISO date (YYYY-MM-DD) for start date
    - to_date: ISO date (YYYY-MM-DD) for end date  
    - status: Filter by trade status
    """
    export_service = ExportService(db)
    
    # Validate date formats if provided
    if from_date:
        try:
            datetime.strptime(from_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid from_date format. Use YYYY-MM-DD"
            )
    
    if to_date:
        try:
            datetime.strptime(to_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid to_date format. Use YYYY-MM-DD"
            )
    
    csv_content = export_service.export_trades_to_csv(from_date, to_date, trade_status)
    
    if not csv_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No trades found matching the criteria"
        )
    
    # Return as streaming response for download
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=trading_journal_export.csv",
            "Content-Type": "text/csv"
        }
    )


@router.get("/xlsx")
async def export_xlsx(
    from_date: str = None,
    to_date: str = None,
    trade_status: str = None,
    db: Session = Depends(get_db)
):
    """Export trades as XLSX file."""
    export_service = ExportService(db)
    xlsx_bytes = export_service.export_trades_to_xlsx(from_date, to_date, trade_status)
    if not xlsx_bytes:
        raise HTTPException(status_code=404, detail="No trades found matching the criteria")
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=trading_journal_export.xlsx",
        }
    )


@router.post("/backup")
async def trigger_telegram_backup(
    chat_id: str = None,
    summary_text: str = "Manual Trading Journal Backup",
    db: Session = Depends(get_db)
):
    """Trigger Telegram backup of all trades.
    
    Uses TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from env by default.
    Can override chat_id in request body.
    """
    export_service = ExportService(db)
    
    # Get Telegram credentials from environment
    bot_token = settings.TELEGRAM_BOT_TOKEN
    telegram_chat_id = chat_id or settings.TELEGRAM_CHAT_ID
    
    if not bot_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TELEGRAM_BOT_TOKEN not configured"
        )
    
    if not telegram_chat_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TELEGRAM_CHAT_ID not configured and not provided"
        )
    
    # Export all non-deleted trades
    csv_content = export_service.export_trades_to_csv()
    
    if not csv_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No trades available for backup"
        )
    
    # Send to Telegram
    success = await export_service.send_telegram_backup(
        csv_content, telegram_chat_id, bot_token, summary_text
    )
    
    if success:
        return {
            "status": "success",
            "message": "Backup sent to Telegram successfully",
            "trades_exported": max(0, len(csv_content.strip().split('\n')) - 1)
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send backup to Telegram"
        )


@router.get("/health")
async def export_health():
    """Health check for export service."""
    return {
        "status": "healthy",
        "service": "export",
        "endpoints": ["/csv", "/backup"]
    }