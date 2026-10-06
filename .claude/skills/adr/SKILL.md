---
name: adr
description: Write or supersede an Architecture Decision Record in docs/adr. Use when a change introduces a dependency or framework, a data model or security choice, a cross-cutting pattern, or changes an existing convention.
---

# Architecture Decision Records

**When an ADR is needed:** new runtime dependency or tool, data model/schema design, auth/RLS approach, state or
data-fetching pattern, folder/architecture convention, CI/deploy change, or reversing an earlier ADR.
**Not needed:** routine features following existing patterns, bug fixes, dev-only patch upgrades.

## How

1. Copy `docs/adr/0000-template.md` to `docs/adr/NNNN-kebab-title.md` (next free number).
2. Fill in: Status (`Accepted` when merged with the change), Date, Context, Decision, Consequences, Alternatives.
3. **Be brief: aim for under ~30 lines.** Bullets over prose. State the decision so someone can follow it without
   reading the PR.
4. Add a row to the table in `docs/adr/README.md`.
5. Superseding: never rewrite an accepted ADR's decision. Write a new ADR, and change only the old one's status line to
   `Superseded by NNNN`.
6. If the decision changes a rule agents follow, update `AGENTS.md` too.
