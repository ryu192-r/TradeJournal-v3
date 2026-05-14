#!/usr/bin/env python3
"""Test script for export service."""

import sys
import os
from datetime import datetime

# Add project root to path
sys.path.append("/root/projects/Trading Journal v3/backend")

from app.services.export_service import ExportService
from app.db.database import SessionLocal

def test_export_service():
    """Test the export service functionality."""
    print("🧪 Testing Export Service...")
    
    db = SessionLocal()
    try:
        export_service = ExportService(db)
        
        # Test CSV export
        print("📋 Testing CSV export...")
        csv_content = export_service.export_trades_to_csv()
        
        if csv_content:
            lines = csv_content.split('\n')
            print(f"✅ CSV export successful: {len(lines)} lines")
            print(f"📊 Header: {lines[0] if lines else 'N/A'}")
            print(f"📊 Sample data line: {lines[1] if len(lines) > 1 else 'N/A'}")
        else:
            print("⚠️  No trades found (empty CSV)")
        
        # Test with date filter
        print("📅 Testing date filter...")
        today = datetime.now().strftime('%Y-%m-%d')
        filtered_csv = export_service.export_trades_to_csv(from_date=today)
        
        if filtered_csv:
            filtered_lines = filtered_csv.split('\n')
            print(f"✅ Date filter successful: {len(filtered_lines)} lines")
        else:
            print("⚠️  No trades for today")
            
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = test_export_service()
    sys.exit(0 if success else 1)