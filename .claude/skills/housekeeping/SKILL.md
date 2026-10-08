---
name: housekeeping
description: Mandatory post-change checklist before every PR — update README and AGENTS.md, update the topic ADRs, remove outdated comments and dead code, and handle refactoring needs. Use after implementing any change and before opening a PR.
---

# Housekeeping

Run after the change works and before review. Look at the diff (`git diff main...HEAD`) and the code around it.

## 1. Documentation

- **README.md** — update if setup steps, scripts, env vars, features or deployment changed.
- **AGENTS.md** — update if commands, conventions, folder structure or workflow changed. Keep it concise; it is
  loaded into every agent session.
- **ADR** — if the change made an architectural decision (new dependency/framework, data model, auth/RLS approach,
  cross-cutting pattern, changed convention), update the ADR for its topic with the `adr` skill, replacing anything
  it reverses. Keep ADRs short; summarise or merge when they grow.
- `docs/product-brief.md` — update only if product behaviour deviates from it deliberately.

## 2. Comments

- In touched files and their direct neighbours, find comments that no longer match the code — fix or delete them.
- Delete commented-out code and comments that restate the code. Keep comments that explain _why_.
- No `TODO` without a linked issue.

## 3. Dead code

- Run `npm run knip`; remove unused files, exports, dependencies and types it reports.
- Remove unused props, branches, feature flags, test helpers and CSS that the change made obsolete.

## 4. Refactoring needs

- Check touched code against the `clean-code` skill: duplication, long functions/components, unclear names, wrong
  feature boundaries.
- Small, safe improvements: do them now with the `refactoring` skill **in a separate commit**.
- Larger ones: don't expand scope; list them under "Notes / follow-ups" in the PR.

## 5. Confirm

Run `npm run verify` again and tick the matching boxes in the PR template.
