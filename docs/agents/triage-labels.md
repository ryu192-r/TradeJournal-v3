# Triage Labels

## Label Vocabulary

| Role | Label | Meaning |
|---|---|---|
| Needs evaluation | `needs-triage` | Maintainer needs to evaluate the issue |
| Waiting on reporter | `needs-info` | Waiting on the reporter for more information |
| AFK-ready | `ready-for-agent` | Fully specified, an agent can pick it up with no human context |
| Human needed | `ready-for-human` | Needs human judgment or implementation |
| Won't fix | `wontfix` | Will not be actioned |

## Rules

- All labels use the exact strings above — no prefixes, no synonyms.
- An issue should have exactly **one** triage label at a time.
- When moving an issue between states, remove the old label and add the new one.
- `needs-triage` is the default for all new issues.
