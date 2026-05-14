#!/usr/bin/env python3
"""
Kanban Review Remediation — creates fix tasks from reviewer comments.

After a reviewer blocks a task with review-required findings, this script:
1. Reads reviewer comment to extract bug descriptions
2. Creates a fix task assigned to the original implementer
3. Links fix task as child of reviewer task
4. Fix task unblocks → implementer fixes → reviewer re-reviews

Usage: python3 scripts/kanban_remediate.py <reviewer_task_id>

This is the Phase 3 review workflow:
  implementer → blocks with review-required:
    → reviewer: finds bugs
      → kanban_remediate.py: creates fix task
        → implementer: fixes bugs
          → reviewer: re-reviews → approves → children promote
"""

import sys
import subprocess
import json
import re
import os
import tempfile
import shlex

WORKSPACE = "dir:/root/projects/Trading Journal v3"

def run(cmd: str, timeout: int = 30) -> str:
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return result.stdout.strip()

def get_task_show_json(task_id: str) -> dict:
    """Get full task info from show."""
    raw = run(f"hermes kanban show {task_id} --json 2>&1")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def get_task_title(task_id: str) -> str:
    """Get task title from show output."""
    raw = run(f"hermes kanban show {task_id} 2>&1")
    match = re.search(r'Task t_[a-f0-9]+: (.+?)\n', raw)
    if match:
        return match.group(1).strip()
    return task_id

def extract_findings(log_text: str) -> list[str]:
    """Extract critical/high findings from reviewer log."""
    findings = []
    in_finding = False
    finding_lines = []
    current_severity = ""
    
    for line in log_text.split('\n'):
        if any(x in line.upper() for x in ['CRITICAL', 'HIGH']):
            if finding_lines and current_severity:
                findings.append(f"[{current_severity}] " + ' '.join(finding_lines).strip())
            finding_lines = []
            current_severity = 'CRITICAL' if 'CRITICAL' in line.upper() else 'HIGH'
            in_finding = True
            finding_lines.append(line.strip())
        elif in_finding:
            if 'Severity:' in line or line.strip() == '':
                if finding_lines:
                    findings.append(f"[{current_severity}] " + ' '.join(finding_lines).strip())
                    finding_lines = []
                    in_finding = False
            else:
                finding_lines.append(line.strip())
    
    if finding_lines and current_severity:
        findings.append(f"[{current_severity}] " + ' '.join(finding_lines).strip())
    
    # Deduplicate and limit
    seen = set()
    unique = []
    for f in findings:
        key = f[:50]
        if key not in seen:
            seen.add(key)
            unique.append(f)
    
    return unique[:5]

def create_fix_task(reviewer_id: str, original_task_id: str, findings: list[str]) -> str | None:
    """Create a remediation task to fix reviewer findings."""
    info = get_task_show_json(original_task_id)
    assignee = info.get('assignee', 'backend')
    original_title = info.get('title', original_task_id)
    
    fix_title = f"Fix: {original_title}"
    
    body = (
        f"Fix issues found in PRD review ({reviewer_id}):\n\n"
    )
    for f in findings:
        body += f"- {f}\n"
    
    body += (
        f"\nRead full review comment on {reviewer_id} for detailed findings.\n"
        f"Update relevant files in {WORKSPACE.replace('dir:', '')}.\n"
        f"Complete this task when done so reviewer can re-approve."
    )
    
    body_file = f"/tmp/kanban_remediate_{reviewer_id}.txt"
    with open(body_file, 'w') as f:
        f.write(body)
    
    cmd = [
        "hermes", "kanban", "create", fix_title,
        "--assignee", assignee,
        "--parent", reviewer_id,
        "--workspace", WORKSPACE,
        "--body", body_file,
        "--json"
    ]
    
    full_cmd = " ".join(shlex.quote(a) for a in cmd)
    output = run(full_cmd)
    
    try:
        os.unlink(body_file)
    except:
        pass
    
    # Parse result
    match = re.search(r'"id":\s*"(t_[a-f0-9]+)"', output)
    if not match:
        match = re.search(r"(t_[a-f0-9]{8})", output)
    if match:
        return match.group(1)
    return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/kanban_remediate.py <reviewer_task_id> [original_task_id]")
        print("  Creates a fix task from reviewer findings.")
        print("  If original_task_id is omitted, reads from reviewer parent info.")
        sys.exit(1)
    
    reviewer_id = sys.argv[1]
    original_id = sys.argv[2] if len(sys.argv) > 2 else None
    
    if not original_id:
        info = get_task_show_json(reviewer_id)
        parents = info.get('parents', [])
        if parents:
            original_id = parents[0]
        else:
            print("Cannot determine original task ID. Provide as second argument.")
            sys.exit(1)
    
    print(f"Reading review findings from: {reviewer_id}")
    print(f"Original task to fix: {original_id}")
    
    log = run(f"hermes kanban log {reviewer_id} 2>&1")
    findings = extract_findings(log)
    
    if not findings:
        print("No critical/high findings found.")
        return
    
    print(f"\nFound {len(findings)} issues:")
    for f in findings[:5]:
        print(f"  - {f[:100]}...")
    
    fix_id = create_fix_task(reviewer_id, original_id, findings)
    
    if fix_id:
        print(f"\n✓ Created fix task: {fix_id}")
        print("  Assigned to: original implementer")
        print("  Parent: {reviewer_id}")
        print("  After fix completes, reviewer re-reviews")
    else:
        print("\n✗ Failed to create fix task")

if __name__ == "__main__":
    main()
