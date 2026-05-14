#!/usr/bin/env python3
"""
Kanban Review Creator — creates a reviewer task when an implementer blocks for review.

When a task blocks with "review-required", it means the work is done and needs checking.
This script creates a formal reviewer task for that work.

Usage: python3 scripts/kanban_review.py <blocked_task_id>

Flow:
1. Task T finishes -> blocks with review-required
2. Run this script -> creates Reviewer R (T's child)
3. R runs -> finds bugs OR approves
4. If R finds bugs -> R creates Fix task (T's fixer)
5. Fix runs -> completes -> R re-reviews -> R approves
"""

import sys
import subprocess
import json
import re
import os
import tempfile
import shlex


WORKSPACE = "dir:/root/projects/Trading Journal v3"


def run(cmd: str, timeout: int = 20) -> str:
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return result.stdout.strip()


def get_task_info(task_id: str) -> dict | None:
    raw = run(f"hermes kanban show {task_id} --json 2>&1")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def create_reviewer_task(blocked_id: str) -> str | None:
    """Create reviewer task for blocked task."""
    info = get_task_info(blocked_id)
    if not info:
        return None
    
    original_title = info.get('title', blocked_id)
    original_body = info.get('body', '')
    
    reviewer_title = f"Review: {original_title}"
    
    reviewer_body = (
        f"Review the work in blocked task {blocked_id}.\n\n"
        f"Scope:\n{original_body[:500]}\n\n"
        f"Check:\n"
        f"- Does it actually work?\n"
        f"- Code quality and errors?\n"
        f"- Missing files or imports?\n"
        f"- Integration with existing codebase?\n\n"
        f"If issues found: Create a fix task assigned to the original implementer.\n"
        f"If good: call kanban_complete(summary='Approved: ...')."
    )
    
    # Write body to temp file
    body_file = f"/tmp/kanban_review_{blocked_id}.txt"
    with open(body_file, 'w') as f:
        f.write(reviewer_body)
    
    cmd_parts = [
        "hermes", "kanban", "create", reviewer_title,
        "--assignee", "reviewer",
        "--parent", blocked_id,
        "--workspace", WORKSPACE,
        "--body", body_file,
        "--json"
    ]
    
    full_cmd = " ".join(shlex.quote(a) for a in cmd_parts)
    output = run(full_cmd)
    
    try:
        os.unlink(body_file)
    except:
        pass
    
    # Parse result
    match = re.search(r"(t_[a-f0-9]{8})", output)
    if match:
        return match.group(1)
    return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/kanban_review.py <blocked_task_id>")
        print("  Creates a reviewer task for a task blocked with review-required")
        sys.exit(1)
    
    blocked_id = sys.argv[1]
    
    print(f"Creating reviewer for: {blocked_id}")
    
    result_id = create_reviewer_task(blocked_id)
    
    if result_id:
        print(f"Reviewer task created: {result_id}")
    else:
        print("Failed to create reviewer task.")


if __name__ == "__main__":
    main()
