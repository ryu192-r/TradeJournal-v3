"""Run analytics tests ensuring .env is loaded from backend/."""
import os, sys

# Set working directory so decouple picks up .env
os.chdir("/root/projects/Trading Journal v3/backend")
sys.path.insert(0, os.getcwd())

import json
from app.services.analytics_service import (
    get_kpi_summary, get_setup_performance, get_streak_analysis,
    get_r_distribution, get_monthly_pnl, get_daily_pnl,
    get_day_of_week_performance, get_time_of_day_performance,
    get_holding_period_analysis, get_full_dashboard,
)
from app.db.database import SessionLocal

db = SessionLocal()
try:
    kpi = get_kpi_summary(db)
    print("=== KPI ===")
    print(json.dumps(kpi, indent=2, default=str))

    sp = get_setup_performance(db)
    print("\n=== SETUP PERFORMANCE ===")
    print(json.dumps(sp, indent=2, default=str))

    st = get_streak_analysis(db)
    print("\n=== STREAKS ===")
    print(json.dumps(st, indent=2, default=str))

    rd = get_r_distribution(db)
    print("\n=== R DISTRIBUTION ===")
    print(json.dumps(rd, indent=2, default=str))

    mp = get_monthly_pnl(db)
    print("\n=== MONTHLY P&L ===")
    print(json.dumps(mp, indent=2, default=str))

    dp = get_daily_pnl(db)
    print("\n=== DAILY P&L ===")
    print(json.dumps(dp, indent=2, default=str))

    dow = get_day_of_week_performance(db)
    print("\n=== DAY OF WEEK ===")
    print(json.dumps(dow, indent=2, default=str))

    tod = get_time_of_day_performance(db)
    print("\n=== TIME OF DAY ===")
    print(json.dumps(tod, indent=2, default=str))

    hp = get_holding_period_analysis(db)
    print("\n=== HOLDING PERIOD ===")
    print(json.dumps(hp, indent=2, default=str))

    dash = get_full_dashboard(db)
    print(f"\n=== FULL DASHBOARD KEYS: {list(dash.keys())} ===")
    print("ALL TESTS PASSED ✅")
finally:
    db.close()
