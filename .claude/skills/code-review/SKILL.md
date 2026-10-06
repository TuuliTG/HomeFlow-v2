---
name: code-review
description: Pre-PR self-review checklist for HomeFlow changes — correctness, tests, design, security, accessibility, mobile layout, docs. Use before opening a PR or when asked to review a branch or PR.
---

# Code review

Review `git diff main...HEAD` (or the PR). For larger changes delegate to the `code-reviewer` agent for a fresh look.
Report findings as **Blocking / Should fix / Nit**, each with file:line and a concrete fix.

## Checklist

- **Correctness** — does it do what the task/PR says? Edge cases: empty lists, errors, loading, offline, a
  family with one member, a child user.
- **Tests** — new behaviour covered at the right layer (`testing` skill); tests would fail if the code broke.
- **Design** — follows ADRs and `clean-code`; logic in the right place (domain logic out of components, data
  access via feature `api.ts`); no duplication with existing code.
- **Security** — `security` skill checklist; RLS for any new table.
- **UX & a11y** — works at 390px wide and on desktop; labelled controls, roles, focus, contrast, touch targets;
  low-effort interactions (product brief requirement 3).
- **Housekeeping** — README/AGENTS.md/ADR updated as needed; no stale comments, dead code, debug output.
- **Commits & PR** — Conventional Commits, refactors separate, PR template filled in.

Fix blocking and should-fix items before opening/merging the PR.
