# 0001. How we work

- **Updated:** 2026-10-08

## Context

Most changes are made by AI agents in short sessions, often started from a phone. `main` must always be deployable,
and the reasons behind choices must survive between sessions without becoming a pile of documents nobody reads.

## Decisions

- **Decision records** — a handful of short, topic-based ADRs in `docs/adr/` (rules in its README). A new or
  changed decision updates the ADR for its topic; git history keeps what came before.
- **Branches** — every change is made on a short-lived branch named in kebab-case after what it does, without a
  type prefix: `sort-tasks-by-due-date`, `fix-login-on-ios`. Never commit to `main`; a Claude Code hook
  (`.claude/hooks/guard-git.mjs`) blocks it.
- **Commits and PRs** — Conventional Commits (`feat: …`, `fix: …`), refactors in their own commits. PRs fill in
  `.github/pull_request_template.md` and merge (squash) only when CI is green; `main` is branch-protected.
- **CI** (GitHub Actions): format, lint, types, knip, unit tests with coverage, build, Playwright e2e, database
  tests (pgTAP), dependency audit and CodeQL. **Vercel** deploys a preview per PR and production from `main`.
- **Tests** — Vitest + Testing Library, queried by role and label as a user would (coverage ≥ 80%). Feature `api`
  modules are replaced by in-memory fakes (`src/test/`). Playwright e2e runs on Pixel, iPhone and desktop with axe
  checks against a faked Supabase (`e2e/fakeSupabase.ts`). RLS and database functions are tested with pgTAP
  (`supabase/tests`) against local Supabase.

## Consequences

- `main` stays green, and every change can be tried on a phone before it lands.
- Fakes can drift from the real database; pgTAP tests cover the rules that matter for security.
