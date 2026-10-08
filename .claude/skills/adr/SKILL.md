---
name: adr
description: Record or update an Architecture Decision Record in docs/adr. Use when a change introduces a dependency or framework, a data model or security choice, a cross-cutting pattern, or changes an existing convention.
---

# Architecture Decision Records

ADRs are a few short, topic-based files (see `docs/adr/README.md` for the list and the rules).

**When to touch an ADR:** new runtime dependency or tool, data model/schema design, auth/RLS approach, state or
data-fetching pattern, folder/architecture convention, CI/deploy change, or reversing an earlier decision.
**Not needed:** routine features following existing decisions, bug fixes, dev-only patch upgrades.

## How

1. Find the ADR whose topic the decision belongs to. Add or edit its bullets so they state the decision as it is
   now (remove anything it replaces), and bump `Updated`.
2. Only if no topic fits, create `docs/adr/NNNN-kebab-topic.md` (next number) with the same sections as the others:
   Context (2–3 sentences), Decisions, Consequences, Alternatives considered (optional, one or two lines). Add it to
   the table in `docs/adr/README.md`.
3. **Keep each ADR under ~40 lines.** Bullets over prose; name the tables, functions and files involved. If it grows
   too long, summarise older bullets or split the topic.
4. If the decision changes a rule agents follow, update `AGENTS.md` too.
