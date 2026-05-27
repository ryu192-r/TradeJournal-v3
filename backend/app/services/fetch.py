"""
SQL Foundation Layer — Fetch trades as pandas DataFrame.

This is the single source of truth for all analytics data.
Extracted from analytics_service.py to allow isolated SQL testing
and reuse by future services that need trade data.

Returns both fully closed trades AND partial exit realized PnL rows
from open trades so that analytics KPIs reflect all realized gains/losses.
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
    user_id: Optional[int] = None,
) -> pd.DataFrame:
    """Fetch realized trade results as a DataFrame.

    Includes:
    - Fully closed trades (pnl from Trade table)
    - Partial exits from open trades (realized_pnl from PartialExit table)

    Each partial exit is represented as its own row so that analytics
    can count it as a separate realized outcome.

    DataFrame columns:
        id, symbol, direction, entry_price, exit_price, quantity,
        entry_time, exit_time, fees, pnl, setup, tactic,
        stop_price, target_price, r_multiple, status
    """
    conditions_closed = [
        "t.status != 'deleted'",
        "t.exit_price IS NOT NULL",
        "t.pnl IS NOT NULL",
    ]
    conditions_pe = [
        "t.status != 'deleted'",
        "t.exit_price IS NULL",
        "pe.realized_pnl IS NOT NULL",
    ]

    params: Dict[str, Any] = {}
    if user_id is not None:
        conditions_closed.append("t.user_id = :user_id")
        conditions_pe.append("t.user_id = :user_id")
        params["user_id"] = user_id
    if start_date:
        conditions_closed.append("t.entry_time >= :start_date")
        conditions_pe.append("t.entry_time >= :start_date")
        params["start_date"] = start_date
    if end_date:
        conditions_closed.append("t.entry_time <= :end_date")
        conditions_pe.append("t.entry_time <= :end_date")
        params["end_date"] = end_date

    where_closed = " AND ".join(conditions_closed)
    where_pe = " AND ".join(conditions_pe)

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
        WHERE {where_closed}

        UNION ALL

        SELECT
            -pe.id AS id,
            t.symbol,
            t.direction,
            t.entry_price,
            pe.exit_price,
            pe.qty AS quantity,
            t.entry_time,
            pe.exit_time,
            0 AS fees,
            pe.realized_pnl AS pnl,
            t.setup,
            t.tactic,
            t.stop_price,
            t.target_price,
            pe.r_captured AS r_multiple,
            'partial_exit' AS status
        FROM partial_exits pe
        JOIN trades t ON t.id = pe.trade_id
        WHERE {where_pe}
        ORDER BY entry_time ASC
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