#!/usr/bin/env python
"""Final integration test - build the bot application."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set dummy token so build_application doesn't fail
os.environ["TELEGRAM_BOT_TOKEN"] = "dummy:test_token_for_testing"

try:
    from bot import build_application
    app = build_application()
    print("✅ Bot application built successfully")
    print(f"   Handlers: {len(app.handlers)} command handlers registered")
except Exception as e:
    print(f"❌ Failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
