#!/usr/bin/env python3
"""Smoke test: verify setup_playbook module loads and router is registered."""
import sys, os

# Add app directory to path
sys.path.insert(0, '/root/projects/Trading Journal v3/backend')

# Test imports
try:
    from app.models.setup_playbook import SetupPlaybook
    print("[OK] SetupPlaybook model imports")
except Exception as e:
    print(f"[FAIL] Model import: {e}")
    sys.exit(1)

try:
    from app.schemas.setup_playbook import (
        SetupPlaybookCreate,
        SetupPlaybookUpdate,
        SetupPlaybookResponse,
        SetupPlaybookListResponse,
        TacticSchema,
        RiskProfileSchema,
    )
    print("[OK] Pydantic schemas import")
except Exception as e:
    print(f"[FAIL] Schemas import: {e}")
    sys.exit(1)

try:
    from app.routers.setup_playbook import router
    print("[OK] Router imports")
except Exception as e:
    print(f"[FAIL] Router import: {e}")
    sys.exit(1)

try:
    from app.routers.base import api_router
    print("[OK] Router registered in api_router")
    routes = [r.path for r in api_router.routes]
    setup_routes = [r for r in routes if 'setups' in r]
    print(f"  Setup routes: {setup_routes}")
except Exception as e:
    print(f"[FAIL] Router registration: {e}")
    sys.exit(1)

# Test schema validation
try:
    create_data = {
        "name": "Test Setup",
        "description": "A test setup",
        "tactics": [{"name": "Test Tactic"}],
        "ideal_conditions": ["condition 1"],
        "risk_profile": {"max_risk_pct": 2.0},
        "rules": ["rule 1"],
    }
    validated = SetupPlaybookCreate(**create_data)
    assert validated.name == "Test Setup"
    assert len(validated.tactics) == 1
    print("[OK] Schema validation works")
except Exception as e:
    print(f"[FAIL] Schema validation: {e}")
    sys.exit(1)

print("\n[ALL TESTS PASSED]")
