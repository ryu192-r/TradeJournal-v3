#!/usr/bin/env python3
"""
Kanban dispatch helper — unblock tasks intelligently based on model provider.

Rules:
- Backend uses `nous` provider → unlimited concurrency, can always start
- All other profiles use Ollama Cloud → max 2 concurrent tasks across ALL profiles
- Never unblock more than 2 Ollama tasks at once
- Queue remaining Ollama tasks and unblock when one completes

Usage: python3 scripts/kanban_dispatch.py [board]

Shows:
1. Current running tasks (by model/provider)
2. Ready tasks waiting to be dispatched
3. Recommendations: which tasks to unblock next
4. Auto-unblock mode: unblock the optimal set

Modes:
  --dry-run    Show what would be unblocked (default)
  --auto       Automatically unblock the optimal set
"""

import sys
import subprocess
import json
import os


# Profile → provider mapping
PROVIDERS = {
    "backend": "nous",  # qwen/qwen3.6-plus via nous (unlimited)
    "frontend": "ollama-cloud",
    "data": "ollama-cloud",
    "reviewer": "ollama-cloud",
    "devops": "ollama-cloud",
}

def get_config(path: str) -> dict | None:
    import yaml
    try:
        with open(path) as f:
            return yaml.safe_load(f)
    except Exception:
        return None


def discover_provider(profile: str) -> str:
    """Read provider from profile config."""
    config_path = os.path.expanduser(f"~/.hermes/profiles/{profile}/config.yaml")
    cfg = get_config(config_path)
    if cfg:
        return cfg.get("model", {}).get("provider", "unknown")
    return PROVIDERS.get(profile, "unknown")


def run(cmd: str) -> str:
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=20)
    return result.stdout.strip()


def parse_tasks(output: str) -> list[dict]:
    """Parse hermes kanban list output into structured data."""
    tasks = []
    for line in output.split("\n"):
        import re
        match = re.match(r"^([●◻⊘✓▶])\s+(t_[a-f0-9]{8})\s+(\w+)\s+(\w+)\s+(.*)$", line.strip())
        if match:
            tasks.append({
                "id": match.group(2),
                "status": match.group(3),
                "assignee": match.group(4),
                "title": match.group(5).strip(),
                "provider": discover_provider(match.group(4)),
            })
    return tasks


def main():
    board = sys.argv[1] if len(sys.argv) > 1 else "tjv3"
    mode = "--auto" if "--auto" in sys.argv else "--dry-run"

    print(f"Board: {board}")
    print("=" * 50)

    # Get all tasks
    running_raw = run(f"hermes kanban list --status running 2>&1")
    ready_raw = run(f"hermes kanban list --status ready 2>&1")

    running = parse_tasks(running_raw)
    ready = parse_tasks(ready_raw)

    # Count by provider
    provider_counts = {}
    for t in running:
        p = t.get("provider", "unknown")
        provider_counts[p] = provider_counts.get(p, 0) + 1

    print("\nCurrent running tasks:")
    if running:
        for t in running:
            print(f"  ● {t['id']} ({t['assignee']} / {t['provider']}): {t['title']}")
    else:
        print("  (none)")

    print(f"\nProvider usage:")
    print(f"  nous (unlimited): {provider_counts.get('nous', 0)} running")
    print(f"  ollama-cloud (max 2): {provider_counts.get('ollama-cloud', 0)}/2 running")

    # Ready tasks (waiting to be dispatched)
    if ready:
        print(f"\nReady tasks (waiting):")
        for t in ready:
            status_indicator = "✅" if t['provider'] == 'nous' else "⏳"
            print(f"  {status_indicator} {t['id']} ({t['assignee']} / {t['provider']}): {t['title']}")

        # Determine what to unblock next
        nous_running = sum(1 for t in running if t['provider'] == 'nous')
        ollama_running = sum(1 for t in running if t['provider'] == 'ollama-cloud')

        # Ollama slots available
        ollama_slots = max(0, 2 - ollama_running)

        print(f"\nDispatch recommendations:")
        print(f"  Ollama slots: {ollama_slots}/2 available")

        to_unblock_ollama = []
        to_unblock_nous = []

        for t in ready:
            if t['provider'] == 'nous':
                to_unblock_nous.append(t)
            elif ollama_slots > 0:
                to_unblock_ollama.append(t)
                ollama_slots -= 1

        if to_unblock_nous:
            print(f"\n  Backend (nous) — unlimited:")
            for t in to_unblock_nous:
                print(f"    ✅ {t['id']}: {t['title']}")

        if to_unblock_ollama:
            print(f"\n  Ollama Cloud — unblock now:")
            for t in to_unblock_ollama:
                print(f"    ✅ {t['id']}: {t['title']}")

        remaining = [t for t in ready if t not in to_unblock_ollama and t not in to_unblock_nous]
        if remaining:
            print(f"\n  Queue (wait for Ollama slot):")
            for t in remaining:
                print(f"    ⏳ {t['id']}: {t['title']}")

        # Auto-unblock
        if mode == "--auto":
            all_to_unblock = to_unblock_ollama + to_unblock_nous
            if all_to_unblock:
                print(f"\nAuto-unblocking {len(all_to_unblock)} tasks:")
                for t in all_to_unblock:
                    cmd = f"hermes kanban unblock {t['id']} 2>&1"
                    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                    print(f"  {t['id']}: {result.stdout.strip()}")
            else:
                print("\nNo tasks to unblock at this time.")
    else:
        print(f"\nNo ready tasks waiting.")

    print("\n" + "=" * 50)


if __name__ == "__main__":
    main()
