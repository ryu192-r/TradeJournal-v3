# Triage Labels

The skills speak in terms of five canonical triage roles and two category roles. This file maps those roles to the actual label strings configured in this repo's GitHub Issues.

## Category labels

Every issue should have exactly one category label.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `bug`                      | `bug`                | Something is broken                      |
| `enhancement`              | `enhancement`        | New feature or improvement               |

## Triage labels

Every issue should have exactly one triage label at a time. New issues default to `needs-triage`.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

## State transitions

```
needs-triage ──→ needs-info ──→ needs-triage (reporter replies)
     │
     ├──→ ready-for-agent (fully specified, AFK-ready)
     ├──→ ready-for-human (needs human judgment)
     └──→ wontfix (won't action)
```

## Rules

- Use the exact label strings above.
- An issue should have exactly one category label and one triage label at a time.
- New issues default to `needs-triage`.
- When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.
- Override: edit the right-hand column to match a different vocabulary if this repo changes its labels.