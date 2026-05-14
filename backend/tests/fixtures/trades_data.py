"""Test fixtures: Golden DataFrame and edge case DataFrames."""

from datetime import datetime
from decimal import Decimal
import pandas as pd


# Golden DataFrame: 10 diverse trades for standard happy-path tests.
GOLDEN_TRADES = pd.DataFrame(
    [
        {
            "id": 1,
            "symbol": "RELIANCE",
            "direction": "LONG",
            "entry_price": 2500.0,
            "exit_price": 2550.0,
            "quantity": 10.0,
            "entry_time": datetime(2025, 1, 13, 9, 30),
            "exit_time": datetime(2025, 1, 13, 10, 0),
            "fees": Decimal("2.5"),
            "pnl": Decimal("497.5"),
            "setup": "Breakout",
            "tactic": "ORB",
            "stop_price": 2480.0,
            "target_price": None,
            "r_multiple": 2.5,
            "status": "closed_target_hit",
        },
        {
            "id": 2,
            "symbol": "TCS",
            "direction": "SHORT",
            "entry_price": 3800.0,
            "exit_price": 3700.0,
            "quantity": 5.0,
            "entry_time": datetime(2025, 1, 13, 9, 45),
            "exit_time": datetime(2025, 1, 13, 15, 30),
            "fees": Decimal("1.8"),
            "pnl": Decimal("498.2"),
            "setup": "VWAP Rejection",
            "tactic": None,
            "stop_price": 3850.0,
            "target_price": None,
            "r_multiple": 1.0,
            "status": "closed_manual",
        },
        {
            "id": 3,
            "symbol": "INFY",
            "direction": "LONG",
            "entry_price": 1600.0,
            "exit_price": 1580.0,
            "quantity": 20.0,
            "entry_time": datetime(2025, 1, 14, 9, 30),
            "exit_time": datetime(2025, 1, 14, 10, 30),
            "fees": Decimal("3.0"),
            "pnl": Decimal("-403.0"),
            "setup": "Pullback",
            "tactic": None,
            "stop_price": 1590.0,
            "target_price": None,
            "r_multiple": -2.0,
            "status": "closed_sl_hit",
        },
        {
            "id": 4,
            "symbol": "HDFC",
            "direction": "SHORT",
            "entry_price": 1700.0,
            "exit_price": 1710.0,
            "quantity": 10.0,
            "entry_time": datetime(2025, 1, 14, 11, 0),
            "exit_time": datetime(2025, 1, 14, 12, 0),
            "fees": Decimal("1.7"),
            "pnl": Decimal("-101.7"),
            "setup": None,
            "tactic": None,
            "stop_price": None,
            "target_price": None,
            "r_multiple": -1.0,
            "status": "closed_manual",
        },
        {
            "id": 5,
            "symbol": "SBIN",
            "direction": "LONG",
            "entry_price": 700.0,
            "exit_price": 735.0,
            "quantity": 30.0,
            "entry_time": datetime(2025, 1, 15, 9, 30),
            "exit_time": datetime(2025, 1, 15, 15, 0),
            "fees": Decimal("2.1"),
            "pnl": Decimal("1047.9"),
            "setup": "Breakout",
            "tactic": "ORB",
            "stop_price": 680.0,
            "target_price": 750.0,
            "r_multiple": 3.0,
            "status": "closed_target_hit",
        },
        {
            "id": 6,
            "symbol": "ICICI",
            "direction": "LONG",
            "entry_price": 900.0,
            "exit_price": 950.0,
            "quantity": 15.0,
            "entry_time": datetime(2025, 1, 15, 10, 0),
            "exit_time": datetime(2025, 1, 15, 15, 30),
            "fees": Decimal("1.35"),
            "pnl": Decimal("748.65"),
            "setup": "Breakout",
            "tactic": "PDH",
            "stop_price": 890.0,
            "target_price": 1000.0,
            "r_multiple": 5.0,
            "status": "closed_target_hit",
        },
        {
            "id": 7,
            "symbol": "TATASTEEL",
            "direction": "LONG",
            "entry_price": 150.0,
            "exit_price": 140.0,
            "quantity": 100.0,
            "entry_time": datetime(2025, 1, 16, 11, 30),
            "exit_time": datetime(2025, 1, 16, 13, 0),
            "fees": Decimal("1.5"),
            "pnl": Decimal("-1001.5"),
            "setup": "Reversal",
            "tactic": None,
            "stop_price": 142.0,
            "target_price": None,
            "r_multiple": -5.0,
            "status": "closed_sl_hit",
        },
        {
            "id": 8,
            "symbol": "HCLTECH",
            "direction": "SHORT",
            "entry_price": 1200.0,
            "exit_price": 1180.0,
            "quantity": 10.0,
            "entry_time": datetime(2025, 1, 16, 14, 0),
            "exit_time": datetime(2025, 1, 16, 15, 0),
            "fees": Decimal("1.2"),
            "pnl": Decimal("198.8"),
            "setup": "EP",
            "tactic": "ORB",
            "stop_price": 1220.0,
            "target_price": 1180.0,
            "r_multiple": 1.0,
            "status": "closed_target_hit",
        },
    ],
)

# Edge case DataFrames
EMPTY_DF = pd.DataFrame()

SINGLE_WIN = pd.DataFrame(
    [
        {
            "id": 1, "symbol": "WINNER", "direction": "LONG",
            "entry_price": 100.0, "exit_price": 200.0, "quantity": 10.0,
            "entry_time": datetime(2025, 1, 1, 10, 0),
            "exit_time": datetime(2025, 1, 1, 11, 0),
            "fees": 1.0, "pnl": 999.0, "setup": "Breakout",
            "tactic": "ORB", "stop_price": 90.0, "target_price": None,
            "r_multiple": 5.0, "status": "closed_target_hit",
        }
    ]
)

SINGLE_LOSS = pd.DataFrame(
    [
        {
            "id": 1, "symbol": "LOSER", "direction": "LONG",
            "entry_price": 100.0, "exit_price": 50.0, "quantity": 10.0,
            "entry_time": datetime(2025, 1, 1, 10, 0),
            "exit_time": datetime(2025, 1, 1, 11, 0),
            "fees": 1.0, "pnl": -501.0, "setup": "Pullback",
            "tactic": None, "stop_price": 95.0, "target_price": None,
            "r_multiple": -1.0, "status": "closed_sl_hit",
        }
    ]
)

NO_R_MULTIPLE = GOLDEN_TRADES.copy()
NO_R_MULTIPLE["r_multiple"] = None


def _to_datetime(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
