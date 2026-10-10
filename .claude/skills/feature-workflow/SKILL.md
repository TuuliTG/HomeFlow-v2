---
name: feature-workflow
description: End-to-end workflow for any code change in HomeFlow (feature, fix, refactor, chore) — branch, test-first, verify, housekeeping, review, PR. Use at the start of every task that changes files.
---

# Feature workflow

Follow these steps in order. Do not skip steps; say explicitly if one does not apply.

1. **Understand** — Read `AGENTS.md`, `docs/product-brief.md` (for features) and relevant ADRs in `docs/adr/`.
   Find existing code to reuse before writing new code.
2. **Branch** — `git switch -c <what-the-change-does>` from an up-to-date `main`: kebab-case, descriptive, no
   type prefix (`sort-tasks-by-due-date`, `fix-login-on-ios`). Never commit on `main`. If the session assigned a
   generated branch name, use a descriptive one instead (see `AGENTS.md`).
3. **Plan** — List the smallest set of changes. If it involves a new dependency, schema, security model or
   cross-cutting pattern, plan the ADR update (`adr` skill).
4. **Test first** — Write or update a failing test that describes the behaviour (`testing` skill).
5. **Implement** — Small steps, keeping tests green. Apply the `clean-code` and `security` skills.
   Commit with Conventional Commits (`feat: add task pick-up button`).
6. **Verify** — `npm run verify` must pass. Run `npm run e2e` when a user flow or layout changed.
   Fix the cause; never weaken lint rules, types or thresholds to pass.
7. **Housekeeping** — Run the `housekeeping` skill (docs, ADRs, stale comments, dead code, refactoring).
8. **Review** — Run the `code-review` skill or delegate to the `code-reviewer` agent. Address findings.
9. **PR** — Push the branch (`git push -u origin <branch>`) and open a PR filling in
   `.github/pull_request_template.md`. Mention the Vercel preview for UI changes.
10. **Merge** only after CI is green. After merge, delete the branch.
