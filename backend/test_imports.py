#!/usr/bin/env python
"""Import test for all affected modules."""
import sys
sys.path.insert(0, '.')

print("Testing imports...")
from app.utils.decimal_utils import ensure_decimal
from app.schemas import capital_event as ce_schema
from app.schemas import account as acc_schema
from app.models import capital_event as ce_model
from app.models import account as acc_model
from app.routers import capital_events
from app.routers import accounts
from app.routers import base as base_router
print("All imports OK")

# Test ensure_decimal
from decimal import Decimal
assert ensure_decimal(None) is None
assert ensure_decimal(1.5) == Decimal("1.5")
assert ensure_decimal("2.5") == Decimal("2.5")
assert ensure_decimal(Decimal("3")) == Decimal("3")
assert ensure_decimal(42) == 42  # int passthrough
print("ensure_decimal OK")

# Verify CapitalEvent has account_id
assert hasattr(ce_model.CapitalEvent, 'account_id'), "CapitalEvent missing account_id"
print("CapitalEvent.account_id OK")

# Verify Account has capital_events relationship
assert hasattr(acc_model.Account, 'capital_events'), "Account missing capital_events relationship"
print("Account.capital_events OK")

print("\nAll tests passed!")
