#!/usr/bin/env python3
"""
Automated daily backup script for Trading Journal v3.

This script:
1. Exports all trades as CSV
2. Sends backup to Telegram
3. Can be scheduled via cron at market close
"""

import os
import sys
from datetime import datetime
import asyncio
import httpx

# Add project root to path
sys.path.append("/root/projects/Trading Journal v3/backend")

from app.services.export_service import ExportService
from app.db.database import SessionLocal
from app.core.config import settings


def get_env_var(name: str) -> str:
    """Get environment variable with error handling."""
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def export_trades_csv() -> str:
    """Export all trades to CSV."""
    db = SessionLocal()
    try:
        export_service = ExportService(db)
        return export_service.export_trades_to_csv()
    finally:
        db.close()


async def send_telegram_backup(csv_content: str) -> bool:
    """Send CSV backup to Telegram."""
    if not csv_content:
        print("No trades to backup")
        return False
    
    try:
        bot_token = get_env_var("TELEGRAM_BOT_TOKEN")
        chat_id = get_env_var("TELEGRAM_CHAT_ID")
        
        export_service = ExportService(SessionLocal())
        success = await export_service.send_telegram_backup(
            csv_content, chat_id, bot_token,
            summary_text=f"📊 Daily Trading Journal Backup - {datetime.now().strftime('%Y-%m-%d')}"
        )
        return success
    except Exception as e:
        print(f"Telegram backup failed: {e}")
        return False


def main():
    """Main backup execution."""
    print(f"🚀 Starting daily backup at {datetime.now()}")
    
    try:
        # Export trades
        print("📋 Exporting trades to CSV...")
        csv_content = export_trades_csv()
        
        if not csv_content:
            print("⚠️  No trades found for backup")
            return 1
        
        print(f"✅ Exported {len(csv_content.split(chr(10))) - 1} lines")
        
        # Send to Telegram
        print("📤 Sending to Telegram...")
        success = asyncio.run(send_telegram_backup(csv_content))
        
        if success:
            print("🎉 Backup completed successfully!")
            return 0
        else:
            print("❌ Telegram backup failed")
            return 1
            
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())