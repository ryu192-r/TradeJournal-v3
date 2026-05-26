# Issue Tracker: GitHub

Issues and PRDs for this repo live as GitHub Issues.

**Repo:** https://github.com/ryu192-r/TradeJournal-v3/issues

## CLI

Use the `gh` CLI for all issue operations. `gh` auto-detects the repo from the git remote.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`. Use `--json` + `jq` for structured data.
- **List issues**: `gh issue list --state open --json number,title,body,labels --jq '[.[] | {number, title, labels: [.labels[].name]}]'` with `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close an issue**: `gh issue close <number> --comment "..."`

## Category labels

Every issue should have exactly one **category label** from:

| Label | Usage |
|-------|-------|
| `bug` | Something is broken |
| `enhancement` | New feature or improvement |

## Triage labels

Every issue should have exactly one **triage label** from the vocabulary in `docs/agents/triage-labels.md`. New issues default to `needs-triage`.

## Workflow

1. New issues start with `needs-triage` label + a category label (`bug` or `enhancement`).
2. After evaluation, move the triage label to `needs-info`, `ready-for-agent`, `ready-for-human`, or `wontfix`.
3. `ready-for-agent` issues are self-contained and AFK-ready — an agent can pick them up with no human context.
4. `ready-for-human` issues need human judgment or implementation (design decisions, manual testing, external access).
5. Closed issues should have a closing comment explaining the resolution.

## When a skill says "publish to the issue tracker"

Create a GitHub issue using `gh issue create`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.