#!/usr/bin/env python3
"""
Kanban pre-flight checker — run BEFORE creating Phase N tasks.

Catches the 3 root causes of 95% of kanban worker failures:
1. toolsets stored as YAML string (not list) → kanban_complete missing
2. model too big for Ollama Cloud → timeout / 429
3. agent.max_turns too low for task complexity → iteration budget exhausted

Usage: python3 scripts/kanban_preflight.py [profile1 profile2 ...]
       (no args = check all known profiles)
"""

import sys
import os
import yaml


KNOWN_PROFILES = ["backend", "frontend", "data", "reviewer", "devops"]

PROFILE_DIR = os.path.expanduser("~/.hermes/profiles")

# Thresholds
MAX_REASONABLE_PARAMS = 100  # models > 100B likely to timeout on Ollama Cloud
MIN_MAX_TURNS = 100
REQUIRED_TOOLSETS = {"files", "terminal", "code", "kanban"}

# Models known to work well on Ollama Cloud kanban workers
SAFE_MODELS = {
    "glm-5.1",
    "kimi-k2.6",
    "deepseek-v4-pro",
    "devstral-small-2:24b",
    "qwen3-next:80b",
    "qwen/qwen3.6-plus",  # via nous provider
}

# Models known to be problematic (too big, hit 429 often)
DANGEROUS_MODELS = {
    "qwen3-coder:480b",
    "kimi-k2:1t",
    "qwen3-480b",
}


def check_profile(profile: str) -> list[str]:
    """Check a single profile config. Returns list of issues (empty = OK)."""
    path = os.path.join(PROFILE_DIR, profile, "config.yaml")
    issues: list[str] = []

    # 1. File exists & is valid YAML
    try:
        with open(path) as f:
            cfg = yaml.safe_load(f)
    except yaml.YAMLError as e:
        return [f"  ❌ Invalid YAML: {e}"]
    except FileNotFoundError:
        return [f"  ⚠️  Profile '{profile}' does not exist (create it first)"]

    # 2. Toolsets — must be a LIST, not a string
    toolsets = cfg.get("toolsets")
    if toolsets is None:
        issues.append(f"  ❌ toolsets key missing")
    elif isinstance(toolsets, str):
        issues.append(
            f"  ❌ toolsets is a YAML STRING (not a list).\n"
            f"      Found: {toolsets[:60]}\n"
            f"      Fix: edit config.yaml directly with:\n"
            f"        toolsets:\n"
            f"          - files\n"
            f"          - terminal\n"
            f"          - code\n"
            f"          - kanban"
        )
    elif isinstance(toolsets, list):
        missing = REQUIRED_TOOLSETS - set(toolsets)
        if missing:
            issues.append(
                f"  ❌ Missing toolsets: {', '.join(sorted(missing))}\n"
                f"      Workers won't have these tools available."
            )
        else:
            pass  # OK — toolsets is a list with all required tools
    else:
        issues.append(f"  ❌ toolsets is unexpected type: {type(toolsets).__name__}")

    # 3. Model size / stability
    model = cfg.get("model", {}).get("default", "unknown")
    provider = cfg.get("model", {}).get("provider", "unknown")

    if model in DANGEROUS_MODELS:
        issues.append(
            f"  ⚠️  Model '{model}' is known to hit Ollama Cloud rate limits.\n"
            f"      Consider replacing with a lighter model (< 100B params)\n"
            f"      or use a non-Ollama provider (nous, openrouter)."
        )
    elif model not in SAFE_MODELS:
        # Check if it's a big param model by name heuristic
        if any(x in model for x in ["480b", "600b", "1t", "8b"]):
            issues.append(
                f"  ⚠️  Model '{model}' may be too large for Ollama Cloud.\n"
                f"      Watch for HTTP 429 / timeout errors."
            )

    # If using nous/openrouter provider, model size is less of a concern
    if provider in ("nous", "openrouter"):
        pass  # Cloud provider handles scaling

    # 4. max_turns
    max_turns = cfg.get("agent", {}).get("max_turns", 70)
    if max_turns < MIN_MAX_TURNS:
        issues.append(
            f"  ⚠️  agent.max_turns = {max_turns} (minimum recommended: {MIN_MAX_TURNS})\n"
            f"      Complex tasks will hit iteration budget exhaustion.\n"
            f"      Fix: hermes -p {profile} config set agent.max_turns 120"
        )

    # 5. reasoning_effort (informational)
    effort = cfg.get("agent", {}).get("reasoning_effort", "default")

    if not issues:
        return [f"  ✅ OK — model={model} ({provider}), turns={max_turns}, effort={effort}"]

    return issues


def main():
    profiles = sys.argv[1:] if len(sys.argv) > 1 else KNOWN_PROFILES

    print("=" * 60)
    print("  KANBAN PRE-FLIGHT CHECK")
    print("=" * 60)

    all_ok = True
    for profile in profiles:
        print(f"\n--- {profile} ---")
        issues = check_profile(profile)
        for issue in issues:
            print(issue)
        if any("❌" in i for i in issues):
            all_ok = False

    print()
    print("=" * 60)
    if all_ok:
        print("  ALL PROFILES PASSED ✅")
    else:
        print("  ❌ ISSUES FOUND — fix before creating kanban tasks")
    print("=" * 60)

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
