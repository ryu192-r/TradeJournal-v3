"""
SQL Foundation Layer — Fetch trades as pandas DataFrame.

This is the single source of truth for all analytics data.
Extracted from analytics_service.py to allow isolated SQL testing
and reuse by future services that need trade data.
"""

from datetime import datetime
from typing import Optional, Dict, Any

import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session


def fetch_trades(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> pd.DataFrame:
    """Fetch completed, non-deleted trades within date range.

    Returns a DataFrame with columns:
        id, symbol, direction, entry_price, exit_price, quantity,
        entry_time, exit_time, fees, pnl, setup, tactic,
        stop_price, target_price, r_multiple, status
    """
    conditions = [
        "t.status != 'deleted'",
        "t.exit_price IS NOT NULL",
        "t.pnl IS NOT NULL",
    ]

    params: Dict[str, Any] = {}
    if start_date:
        conditions.append("t.entry_time >= :start_date")
        params["start_date"] = start_date
    if end_date:
        conditions.append("t.entry_time <= :end_date")
        params["end_date"] = end_date

    where_clause = " AND ".join(conditions)

    sql = f"""
        SELECT
            t.id,
            t.symbol,
            t.direction,
            t.entry_price,
            t.exit_price,
            t.quantity,
            t.entry_time,
            t.exit_time,
            t.fees,
            t.pnl,
            t.setup,
            t.tactic,
            t.stop_price,
            t.target_price,
            t.r_multiple,
            t.status
        FROM trades t
        WHERE {where_clause}
        ORDER BY t.entry_time ASC
    """
    result = db.execute(text(sql), params)
    rows = result.fetchall()
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows, columns=result.keys())

    # Convert numeric columns
    for col in [
        "pnl", "r_multiple", "fees", "entry_price",
        "exit_price", "quantity", "stop_price", "target_price",
    ]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Convert timestamps
    for col in ["entry_time", "exit_time"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    return df
