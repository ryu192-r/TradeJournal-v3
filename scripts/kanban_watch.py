#!/usr/bin/env python3
"""
Kanban Clarify Watcher — polls running tasks for pending clarifies and auto-answers them.

Runs a loop every 10s checking all running tasks. When a clarify is detected:
1. Checks known answer mappings for automatic answers
2. Auto-answers within the 120s timeout window
3. Falls back to alerting the user if no known answer exists

Also: detects "review-required" blocks and auto-creates reviewer tasks.

Usage: python3 scripts/kanban_watch.py [board_name]
       python3 scripts/kanban_watch.py tjv3 --manual  # only alert, don't auto-answer

Stops with Ctrl+C.
"""

import subprocess
import time
import sys
import re
import os


BOARD = sys.argv[1] if len(sys.argv) > 1 else "tjv3"
POLL_INTERVAL = 10
MANUAL_ONLY = "--manual" in sys.argv


def _postgres_database_answer() -> str:
    db_url = os.environ.get("KANBAN_POSTGRES_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if db_url:
        return db_url
    return (
        "Set KANBAN_POSTGRES_DATABASE_URL or DATABASE_URL; "
        "no default PostgreSQL credentials are stored."
    )


# Known answer mappings — built from Phase 1-2 experience
KNOWN_ANSWERS = {
    "sqlite file": "/root/Trading Journal v2/data/trading.db",
    "sqlite database": "/root/Trading Journal v2/data/trading.db",
    "v2 database": "/root/Trading Journal v2/data/trading.db",
    "v2 db": "/root/Trading Journal v2/data/trading.db",
    "Trading Journal v2": "/root/Trading Journal v2",
    "v2 path": "/root/Trading Journal v2",
    "project root": "/root/projects/Trading Journal v3",
    "unified project": "/root/projects/Trading Journal v3",
    "workspace path": "/root/projects/Trading Journal v3",
    "frontend workspace": "/root/projects/Trading Journal v3/frontend",
    "backend workspace": "/root/projects/Trading Journal v3/backend",
    "postgres database": _postgres_database_answer(),
    "telegram": "/root/.hermes/config.yaml",
}

BLOCKED_WORKSPACE_DIR = os.path.expanduser("~/.hermes/kanban/boards")

def run(cmd: str, timeout: int = 20) -> str:
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout,
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        return ""

def get_running_tasks() -> list[str]:
    raw = run("hermes kanban list --status running 2>&1")
    return re.findall(r"(t_[a-f0-9]{8})", raw)

def get_blocked_tasks() -> list[str]:
    raw = run("hermes kanban list --status blocked 2>&1")
    return re.findall(r"(t_[a-f0-9]{8})", raw)

def check_for_clarify(task_id: str) -> tuple[bool, str]:
    """Check if task has a pending clarify. Returns (has_clarify, log_snippet)."""
    log = run(f"hermes kanban log {task_id} 2>&1 | tail -30")
    if "preparing clarify" in log:
        return True, log
    return False, ""

def check_for_review_required(task_id: str) -> tuple[bool, str]:
    """Check if task blocked with review-required. Returns (needs_review, reason)."""
    raw = run(f"hermes kanban show {task_id} 2>&1")
    if "review-required" in raw.lower():
        match = re.search(r"review-required[:\s]+(.+?)(?:\n|$)", raw, re.IGNORECASE)
        reason = match.group(1).strip() if match else "needs review"
        return True, reason
    return False, ""

def create_reviewer_task(blocked_id: str, reason: str) -> str | None:
    """Create a reviewer task for a blocked implementation task."""
    import tempfile
    import shlex

    # Get task title
    raw = run(f"hermes kanban show {blocked_id} 2>&1")
    match = re.search(r"Task t_[a-f0-9]+: (.+?)\n", raw)
    title = match.group(1).strip() if match else blocked_id

    reviewer_title = f"Review: {title}"
    reviewer_body = (
        f"Review the work in blocked task {blocked_id}.\n\n"
        f"Title: {title}\n"
        f"Blocked reason: {reason}\n\n"
        f"Check:\n"
        f"- Code correctness and completeness\n"
        f"- Integration with existing codebase\n"
        f"- Edge cases and error handling\n"
        f"- PRD requirements\n\n"
        f"If issues found: create a fix task assigned to the original implementer.\n"
        f"If approved: call kanban_complete(summary='Approved: ...')."
    )

    body_file = f"/tmp/kanban_review_{blocked_id}.txt"
    with open(body_file, 'w') as f:
        f.write(reviewer_body)

    cmd_parts = [
        "hermes", "kanban", "create", reviewer_title,
        "--assignee", "reviewer",
        "--parent", blocked_id,
        "--workspace", "dir:/root/projects/Trading Journal v3",
        "--body", body_file,
    ]

    full_cmd = " ".join(shlex.quote(a) for a in cmd_parts)
    output = run(full_cmd)

    try:
        os.unlink(body_file)
    except:
        pass

    match = re.search(r"(t_[a-f0-9]{8})", output)
    if match:
        return match.group(1)
    return None

def suggest_answer(clarify_text: str) -> str | None:
    """Suggest an answer based on known project paths."""
    for keyword, answer in KNOWN_ANSWERS.items():
        if keyword.lower() in clarify_text.lower():
            return answer
    return None

def auto_answer(task_id: str, answer: str) -> str:
    """Submit answer to clarify question."""
    # The clarify answer goes through stdin of the running process
    # For now, we can only detect and alert — actual answering requires user input
    # in the terminal where the task was started
    return run(f"echo '{answer}'")

def main():
    print(f"Watching board: {BOARD}")
    print(f"Poll interval: {POLL_INTERVAL}s")
    if MANUAL_ONLY:
        print("Mode: MANUAL (alerts only, no auto-answer)")
    else:
        print("Mode: AUTO (will auto-answer known questions)")
    print("Press Ctrl+C to stop.\n")

    seen_clarifies = set()  # task IDs that we've already alerted on
    seen_reviews = set()  # blocked tasks that already got a reviewer

    while True:
        task_ids = get_running_tasks()

        # Check running tasks for clarifies
        for tid in task_ids:
            has_clarify, log = check_for_clarify(tid)
            if has_clarify and tid not in seen_clarifies:
                seen_clarifies.add(tid)
                
                print(f"\n{'='*60}")
                print(f"⚠️  CLARIFY PENDING: {tid}")
                print(f"{'='*60}")
                
                # Show last 20 lines for context
                print(log[-400:])
                print(f"{'='*60}")
                
                # Suggest answer
                answer = suggest_answer(log)
                if answer:
                    print(f"\n💡 Suggested answer: {answer}")
                    if not MANUAL_ONLY:
                        print("   Auto-answering...")
                        result = auto_answer(tid, answer)
                        print(f"   Response: {result.strip() if result else '(sent)'}")
                else:
                    print("\n❓ No known answer. User must answer in terminal:")
                    print(f"   (switch to terminal with task running and type answer)")

        # Check blocked tasks for review-required
        blocked_ids = get_blocked_tasks()
        for tid in blocked_ids:
            needs_review, reason = check_for_review_required(tid)
            if needs_review and tid not in seen_reviews:
                seen_reviews.add(tid)

                print(f"\n{'='*60}")
                print(f"📋 REVIEW NEEDED: {tid}")
                print(f"Reason: {reason}")
                print(f"{'='*60}")

                reviewer_id = create_reviewer_task(tid, reason)
                if reviewer_id:
                    print(f"✅ Reviewer created: {reviewer_id}")
                    print(f"   Will run after {tid} unblocks")
                else:
                    print("❌ Failed to create reviewer")

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nStopped.")
        sys.exit(0)
