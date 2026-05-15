# Issue Tracker

## GitHub

Issues are tracked in GitHub Issues for this repo:
https://github.com/ryu192-r/TradeJournal-v3/issues

### CLI

Use the `gh` CLI for all issue operations:

```bash
gh issue create --title "..." --body "..." --label "needs-triage"
gh issue list --state open
gh issue view <number>
gh issue edit <number> --add-label "ready-for-agent"
gh issue close <number>
```

### Workflow

1. New issues start with `needs-triage` label.
2. After evaluation, move to `needs-info`, `ready-for-agent`, `ready-for-human`, or `wontfix`.
3. `ready-for-agent` issues are self-contained — any agent can pick them up with no human context.
4. `ready-for-human` issues need human judgment or implementation.
