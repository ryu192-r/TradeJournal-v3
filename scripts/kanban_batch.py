#!/usr/bin/env python3
"""
Kanban Batch Task Creator — create an entire phase's task graph from a YAML plan.

Usage:
  python3 scripts/kanban_batch.py plans/phase3-daily-journal.yaml

YAML format:
  board: tjv3                         # optional, default: tjv3
  workspace: "dir:/root/projects/Trading Journal v3"  # default for all tasks
  tasks:
    - id: T12
      title: "Daily Journal model"
      assignee: backend
      body: |
        Create DailyJournal SQLAlchemy model.
        File: backend/app/models/daily_journal.py
      parents: []                     # optional
      priority: 0                     # optional, default 0
    - id: T13
      title: "Daily Journal API endpoints"
      assignee: backend
      body: |
        Create POST /api/v1/journal endpoint.
      parents: [T12]                  # references other ids in THIS plan
    - id: R12
      title: "Review daily journal"
      assignee: reviewer
      body: |
        Review daily journal implementation.
      parents: [T13]

The script:
1. Creates tasks in the order listed (topological order)
2. Resolves parent IDs to actual kanban task IDs
3. Auto-creates reviewer cards for backend tasks (if not already listed)
4. Prints a summary with created task IDs and status
"""

import sys
import yaml
import subprocess
import json
import re
import os
import tempfile


import shlex

def run(cmd: str) -> str:
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        print(f"  Command failed: {cmd}")
        print(f"  stderr: {result.stderr.strip()}")
    return result.stdout.strip()


def create_task(task_id: str, title: str, assignee: str, body: str,
                parent_ids: list[str], workspace: str) -> str | None:
    """Create a single kanban task. Returns task_id or None on failure."""
    cmd_parts = [
        "hermes", "kanban", "create",
        f"{task_id}: {title}",
        "--assignee", assignee,
        "--workspace", workspace,
        "--json",
    ]

    for p in parent_ids:
        cmd_parts.extend(["--parent", p])

    # Body via temp file to avoid shell escaping issues
    body_file = None
    if body:
        body_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
        body_file.write(body)
        body_file.close()
        cmd_parts.extend(["--body", body_file.name])

    # Use shlex.quote() for safe shell argument quoting
    full_cmd = " ".join(shlex.quote(a) for a in cmd_parts)
    output = run(full_cmd)

    # NOTE: Don't delete body files immediately — worker needs time to read them
    # The temp dir auto-cleans, so we can skip explicit cleanup
    # if body_file:
    #     os.unlink(body_file.name)

    # Parse JSON output
    try:
        result = json.loads(output)
        created_id = result.get("id")
        if created_id:
            return created_id
    except json.JSONDecodeError:
        pass

    # Fallback: extract task ID from output
    match = re.search(r"(t_[a-f0-9]{8})", output)
    if match:
        return match.group(1)

    return None


def auto_create_reviewer(task_id: str, title: str, body: str,
                         parent_id: str, workspace: str) -> tuple[str, str] | None:
    """Auto-create reviewer card for a backend task. Returns (reviewer_id, actual_id)."""
    reviewer_id = f"R{task_id.lstrip('T').lstrip('t_')}"
    reviewer_title = f"Review {title}"
    reviewer_body = (
        f"Review {task_id} implementation.\n"
        f"Scope: {body[:300]}...\n\n"
        f"Check against PRD:\n"
        f"- Decimal handling (no float serialization)\n"
        f"- Status transition validation (check BEFORE mutation)\n"
        f"- PRD field completeness (chart_images, timestamps, etc.)\n"
        f"- Error handling (400/404/500 responses)\n"
        f"- Duplicate detection and edge cases\n"
        f"- Router registered in base.py"
    )

    print(f"  Auto-generating reviewer card: {reviewer_id}")

    actual_id = create_task(
        reviewer_id, reviewer_title, "reviewer",
        reviewer_body, [parent_id], workspace
    )

    if actual_id:
        return (reviewer_id, actual_id)
    return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/kanban_batch.py <plan.yaml>")
        sys.exit(1)

    plan_file = sys.argv[1]
    try:
        with open(plan_file) as f:
            plan = yaml.safe_load(f)
    except FileNotFoundError:
        print(f"Plan file not found: {plan_file}")
        sys.exit(1)
    except yaml.YAMLError as e:
        print(f"Invalid YAML: {e}")
        sys.exit(1)

    board = plan.get("board", "tjv3")
    workspace = plan.get("workspace", "dir:/root/projects/Trading Journal v3")
    tasks = plan.get("tasks", [])

    if not tasks:
        print("No tasks defined in plan.")
        sys.exit(1)

    # Track which tasks are manual reviewers (already listed in plan)
    manual_reviewer_ids = {t["id"] for t in tasks if t.get("assignee") == "reviewer"}

    print(f"Board: {board}")
    print(f"Workspace: {workspace}")
    print(f"Tasks to create: {len(tasks)}")
    print("=" * 50)

    parent_map = {}  # plan id -> actual kanban task ID
    created = []

    for task_def in tasks:
        task_id = task_def["id"]
        title = task_def["title"]
        assignee = task_def["assignee"]
        body = task_def.get("body", "")

        # Resolve plan parent IDs to actual kanban IDs
        resolved_parents = []
        for p in task_def.get("parents", []):
            if p in parent_map:
                resolved_parents.append(parent_map[p])
            else:
                print(f"  Parent '{p}' not found for {task_id}")

        print(f"\nCreating {task_id}: {title}...")

        actual_id = create_task(task_id, title, assignee, body, resolved_parents, workspace)

        if actual_id:
            parent_map[task_id] = actual_id
            created.append((task_id, actual_id, assignee))
            print(f"  Created: {task_id} -> {actual_id}")

            # Auto-create reviewer for backend tasks (if not already in plan)
            if assignee in ("backend", "frontend") and task_id not in manual_reviewer_ids:
                reviewer = auto_create_reviewer(
                    task_id, title, body, actual_id, workspace
                )
                if reviewer:
                    parent_map[reviewer[0]] = reviewer[1]
                    created.append((reviewer[0], reviewer[1], "reviewer"))
        else:
            print(f"  Failed to create {task_id}")

    # Summary
    print()
    print("=" * 50)
    print("SUMMARY")
    print("=" * 50)
    for plan_id, actual_id, assignee in created:
        print(f"  {plan_id} -> {actual_id} ({assignee})")

    print(f"\nTotal created: {len(created)}/{len(tasks)}")

    # Staggering reminder
    ollama_count = sum(1 for _, _, a in created if a != "backend")
    if ollama_count > 2:
        print(f"\n{ollama_count} Ollama Cloud tasks created.")
        print("Only unblock 2 at a time. The rest will queue.")

    if len(created) == len(tasks):
        print("\nAll tasks created successfully!")
    else:
        print(f"\n{len(tasks) - len(created)} tasks failed to create.")


if __name__ == "__main__":
    main()
