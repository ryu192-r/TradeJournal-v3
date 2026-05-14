#!/usr/bin/env python3
"""Inspect setup_playbook table and create Alembic migration."""
import sys, os

# Add backend/app to path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
backend_dir = os.path.join(project_root, "backend")
app_dir = os.path.join(backend_dir, "app")
sys.path.insert(0, app_dir)

from db.database import engine
from sqlalchemy import text, MetaData, inspect

inspector = inspect(engine)
tables = inspector.get_table_names()
print("Tables:", tables)

if "setup_playbook" in tables:
    columns = inspector.get_columns("setup_playbook")
    print("\n=== Current setup_playbook columns ===")
    for col in columns:
        print(f"  {col['name']}: {col['type']}")

    # Count rows
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM setup_playbook"))
        count = result.scalar()
        print(f"\nRows: {count}")
        
        if count > 0:
            result = conn.execute(text("SELECT id, name FROM setup_playbook ORDER BY id LIMIT 10"))
            for row in result:
                print(f"  ID={row[0]}, name={row[1]}")
else:
    print("Table 'setup_playbook' does NOT exist - creating it...")

print("\nDone")
