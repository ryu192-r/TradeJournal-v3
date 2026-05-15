# Domain Docs

## Layout

This repo uses **single-context** layout:

- `CONTEXT.md` at repo root — domain glossary and flow definitions
- `docs/adr/` at repo root — architectural decision records

## Consumer Rules

1. Read `CONTEXT.md` first to learn domain terms before touching code.
2. Use terms from the glossary in commit messages, issue titles, and PR descriptions.
3. When a term conflicts between code and `CONTEXT.md`, flag it — don't silently change either.
4. Create an ADR in `docs/adr/` when a decision is:
   - Hard to reverse
   - Surprising without context
   - The result of a real trade-off
5. ADR naming: `NNNN-short-title.md` (zero-padded number, kebab-case title).
