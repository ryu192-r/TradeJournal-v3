#!/usr/bin/env python3
"""
Kanban Auto-Recovery — fix crashed/blocked tasks automatically.

Diagnoses the crash type and takes appropriate action:
- Protocol violation + files exist → mark task complete
- Model crash (API error) → reclaim + retry once
- Budget exhaustion → check if partial work exists, complete or reclaim
- Unknown → report with recommendations

Usage: python3 scripts/kanban_recover.py t_XXXXXXXX
"""

import sys
import subprocess
import json
import re


def run(cmd: str) -> str:
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
    return result.stdout.strip()


def get_task_info(task_id: str) -> dict | None:
    raw = run(f"hermes kanban show {task_id} --json 2>&1")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def get_task_log(task_id: str) -> str:
    return run(f"hermes kanban log {task_id} 2>&1")


def find_last_run(events: list[dict]) -> dict | None:
    """Find the last run that crashed/blocked."""
    for event in reversed(events):
        if event.get("kind") in ("crashed", "blocked", "protocol_violation"):
            return event
    return None


def extract_workspace_path(task_info: dict) -> str:
    workspace = task_info.get("workspace_kind", "scratch")
    workspace_path = task_info.get("workspace_path", "")
    return workspace_path


def check_workspace_files(workspace_path: str) -> list[str]:
    """Check if files were written in workspace."""
    if not workspace_path or workspace_path == "scratch":
        return []
    raw = run(f"find {workspace_path} -type f -name '*.py' -o -name '*.tsx' -o -name '*.ts' 2>/dev/null | grep -v node_modules | grep -v __pycache__ | grep -v venv")
    return [f for f in raw.split('\n') if f]


def check_error_type(log: str) -> dict:
    """Diagnose the crash type from log content."""
    result = {
        "type": "unknown",
        "message": "",
        "last_tool_call": "",
        "api_error": False,
    }

    # Check for API errors
    if "HTTP 429" in log or "RateLimitError" in log:
        result["type"] = "rate_limit"
        result["message"] = "Ollama Cloud rate limit (HTTP 429)"
        result["api_error"] = True
    elif "HTTP 500" in log or "InternalServerError" in log:
        result["type"] = "server_error"
        result["message"] = "Model server error (HTTP 500)"
        result["api_error"] = True
    elif "APITimeoutError" in log or "Request timed out" in log:
        result["type"] = "timeout"
        result["message"] = "Model API timeout"
        result["api_error"] = True
    elif "protocol_violation" in log or "WORKER EXITED CLEANLY" in log:
        result["type"] = "protocol_violation"
        result["message"] = "Worker exited without kanban_complete"
    elif "pid" in log and "not alive" in log:
        result["type"] = "crash"
        result["message"] = "Worker process died unexpectedly"
    elif "budget exhausted" in log or "max_turns" in log:
        result["type"] = "budget"
        result["message"] = "Iteration budget exhausted"

    # Extract last tool call
    last_tool = re.findall(r"(?<=preparing\s)(\w+)…", log)
    if last_tool:
        result["last_tool_call"] = last_tool[-1]

    return result


def get_task_id_arg(index: int = 1) -> str:
    """Get task ID from argv or print usage."""
    if len(sys.argv) <= index:
        print("Usage: python3 scripts/kanban_recover.py t_XXXXXXXX")
        sys.exit(1)
    return sys.argv[index]


def main():
    task_id = get_task_id_arg()

    print(f"Recovering task: {task_id}")
    print("=" * 50)

    # Get task info
    task_info = get_task_info(task_id)
    if not task_info:
        print(f"❌ Could not get info for {task_id}")
        sys.exit(1)

    status = task_info.get("status", "unknown")
    print(f"Status: {status}")

    # Get event log
    events = task_info.get("events", [])
    errors = [e for e in events if e.get("kind") == "error" or e.get("outcome") == "crashed"]

    last_error = errors[-1] if errors else None
    if last_error:
        print(f"Last error: {last_error.get('error', 'unknown')}")

    # Get log
    log = get_task_log(task_id)

    # Diagnose
    error_info = check_error_type(log)
    print(f"\nDiagnosis: {error_info['type']}")
    print(f"Message: {error_info['message']}")
    if error_info["last_tool_call"]:
        print(f"Last tool call: {error_info['last_tool_call']}")

    # Check workspace
    workspace_path = extract_workspace_path(task_info)
    files = check_workspace_files(workspace_path)

    if files:
        print(f"\n📁 Workspace files found ({len(files)}):")
        for f in files[:10]:
            print(f"  {f}")
        if len(files) > 10:
            print(f"  ... and {len(files) - 10} more")

    # Recommend action
    print()
    print("─" * 50)
    print("RECOMMENDATION:")

    if status == "blocked":
        if files:
            print("✅ Task has workspace files. Suggest: manually complete and unblock.")
            print("   Command: hermes kanban unblock " + task_id)
            print("   Then: hermes kanban complete " + task_id + " --summary \"...\"")
        else:
            print("🔄 No workspace files. Reclaim and retry:")
            print("   Command: hermes kanban reclaim " + task_id)
    elif error_info["type"] in ("rate_limit", "server_error", "timeout"):
        print("⏳ Model error. Wait 60s, then unblock:")
        print("   Command: hermes kanban unblock " + task_id)
    elif error_info["type"] == "protocol_violation":
        if files:
            print("✅ Files written despite protocol violation. Complete manually:")
            print("   Command: hermes kanban complete " + task_id + " --summary \"...\"")
        else:
            print("❌ No files, protocol violation. Try different model.")
    elif error_info["type"] == "budget":
        if files:
            print("📋 Budget exhausted but files exist. Complete or increase max_turns.")
        else:
            print("💥 Budget exhausted, no files. Task too big — split into smaller tasks.")
    else:
        print("❓ Unknown crash type. Check task log manually:")
        print("   Command: hermes kanban log " + task_id)

    print()
    print("=" * 50)


if __name__ == "__main__":
    main()
