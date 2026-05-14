"""Export service for CSV exports and Telegram backups."""

import csv
import io
from datetime import datetime
from typing import List, Dict, Optional
from decimal import Decimal

import httpx
from sqlalchemy.orm import Session

from app.models.trade import Trade
from app.core.config import settings


class ExportService:
    """Handle trade exports to CSV and Telegram backups."""

    def __init__(self, db: Session):
        self.db = db

    def _format_decimal(self, value: Optional[Decimal]) -> str:
        """Format Decimal for CSV export."""
        if value is None:
            return ""
        return str(value)

    def _format_datetime(self, value: Optional[datetime]) -> str:
        """Format datetime for CSV export."""
        if value is None:
            return ""
        return value.strftime("%Y-%m-%d %H:%M:%S")

    def _trade_to_dict(self, trade: Trade) -> Dict[str, str]:
        """Convert Trade model to CSV-compatible dict."""
        return {
            "symbol": trade.symbol,
            "direction": trade.direction,
            "entry_price": self._format_decimal(trade.entry_price),
            "quantity": self._format_decimal(trade.quantity),
            "entry_time": self._format_datetime(trade.entry_time),
            "exit_price": self._format_decimal(trade.exit_price),
            "exit_time": self._format_datetime(trade.exit_time),
            "fees": self._format_decimal(trade.fees),
            "setup": trade.setup or "",
            "tactic": trade.tactic or "",
            "stop_price": self._format_decimal(trade.stop_price),
            "target_price": self._format_decimal(trade.target_price),
            "r_multiple": self._format_decimal(trade.r_multiple),
            "status": trade.status or "",
            "notes": trade.notes or "",
            "pnl": self._format_decimal(trade.pnl),
            "exit_reason": trade.exit_reason or "",
            "review_notes": trade.review_notes or "",
            "tags": trade.tags or "",
            "review_tags": trade.review_tags or "",
        }

    def export_trades_to_csv(
        self,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        status: Optional[str] = None
    ) -> str:
        """Export trades to CSV string.
        
        Args:
            from_date: ISO date string (YYYY-MM-DD) for start date filter
            to_date: ISO date string (YYYY-MM-DD) for end date filter  
            status: Filter by trade status
            
        Returns:
            CSV content as string
        """
        query = self.db.query(Trade)
        
        # Apply filters
        if status:
            query = query.filter(Trade.status == status)
        
        if from_date:
            from_datetime = datetime.strptime(from_date, "%Y-%m-%d")
            query = query.filter(Trade.entry_time >= from_datetime)
        
        if to_date:
            to_datetime = datetime.strptime(to_date, "%Y-%m-%d")
            query = query.filter(Trade.entry_time <= to_datetime)
        
        # Exclude deleted trades by default
        query = query.filter(Trade.status != "deleted")
        
        trades = query.order_by(Trade.entry_time.asc()).all()
        
        if not trades:
            return ""
        
        # Write to CSV
        output = io.StringIO()
        fieldnames = [
            "symbol", "direction", "entry_price", "quantity", "entry_time",
            "exit_price", "exit_time", "fees", "setup", "tactic",
            "stop_price", "target_price", "r_multiple", "status", "notes",
            "pnl", "exit_reason", "review_notes", "tags", "review_tags"
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for trade in trades:
            writer.writerow(self._trade_to_dict(trade))
        
        return output.getvalue()

    async def send_telegram_backup(
        self,
        csv_content: str,
        chat_id: str,
        bot_token: str,
        summary_text: str = "Daily Trading Journal Backup"
    ) -> bool:
        """Send CSV backup to Telegram.
        
        Args:
            csv_content: CSV string to send
            chat_id: Telegram chat ID
            bot_token: Telegram bot token
            summary_text: Optional summary text
            
        Returns:
            True if successful, False otherwise
        """
        if not csv_content:
            return False
            
        # Create a binary file-like object from the CSV content
        files = {
            "document": ("trading_journal_backup.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")
        }
        
        data = {
            "chat_id": chat_id,
            "caption": summary_text
        }
        
        url = f"https://api.telegram.org/bot{bot_token}/sendDocument"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, files=files, data=data)
                response.raise_for_status()
                return True
        except Exception:
            return False