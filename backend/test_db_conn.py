"""Quick DB connectivity and data shape check."""
import sys
sys.path.insert(0, ".")
from app.db.database import engine
from sqlalchemy import text

with engine.connect() as c:
    count = c.execute(text("SELECT COUNT(*) FROM trades")).scalar()
    print(f"Trade count: {count}")
    cols = c.execute(text("""
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name='trades' ORDER BY ordinal_position
    """)).fetchall()
    for col in cols:
        print(f"  {col[0]:25s} {col[1]}")
    
    # Check a few sample rows
    rows = c.execute(text("SELECT id, symbol, pnl, setup, r_multiple FROM trades LIMIT 3")).fetchall()
    for r in rows:
        print(f"  {r}")
print("DB connection OK")
