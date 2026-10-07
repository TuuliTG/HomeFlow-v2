# AGENTS.md

Instructions for AI coding agents (and humans) working on HomeFlow. `CLAUDE.md` imports this file.

## Project

HomeFlow is a mobile-first PWA for families to share household tasks fairly, crediting both physical work and
planning work. Product context: [docs/product-brief.md](docs/product-brief.md). Decisions: [docs/adr/](docs/adr/README.md).

Stack: Vite + React 19 + TypeScript (strict) · React Router · TanStack Query · Tailwind CSS v4 · Zod · Supabase ·
Vitest + Testing Library · Playwright · deployed on Vercel. Node ≥ 22.12 (`.nvmrc`).

## Commands

| Command                               | Purpose                                                           |
| ------------------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                         | Dev server                                                        |
| `npm run verify`                      | **Gate before every PR**: format, lint, types, knip, tests, build |
| `npm test` / `npm run test:watch`     | Unit/component tests                                              |
| `npm run e2e`                         | Playwright (mobile + desktop); needs `npx playwright install`     |
| `npm run lint:fix` / `npm run format` | Auto-fix lint / formatting                                        |
| `npm run knip`                        | Find dead code, unused exports and dependencies                   |
| `npm run db:migration <name>`         | New Supabase SQL migration (local DB needs Docker)                |

## Architecture rules

- Feature folders: `src/features/<feature>/` holds its components, hooks, `api.ts` and tests side by side.
  `src/app` = shell/routing/providers, `src/components/ui` = shared presentational components, `src/lib` = infrastructure.
- Features must not import other features' internals; promote shared code to `components/ui` or `lib`. Read the
  logged-in user with `useAuth()` from `@/lib/auth` (`useLoggedInUser()` on screens behind the login, ADR 0011).
  Cross-feature composition (e.g. `OnboardingGate`) lives in `src/app`.
- Data access: components → hooks (TanStack Query) → feature `api.ts` → `getSupabaseClient()`. Never call Supabase
  from components (ESLint enforces the import ban). Validate external data with Zod.
- Every Supabase table has Row Level Security enabled with explicit policies. Scope family data with
  `household_id = (select private.current_household_id())` ([ADR 0010](docs/adr/0010-households-and-shared-tasks.md)).
- Mobile first: design for ~390px wide, then enhance with `md:` breakpoints. Accessible by default (roles, labels, contrast).
- Import with the `@/` alias. Add dependencies with `npm install <pkg>` (exact versions are saved automatically).

## Workflow (always)

1. **Never work on `main`.** Create a branch: `feat/…`, `fix/…`, `refactor/…`, `chore/…`, `docs/…`.
2. Plan briefly; write or update tests first where practical.
3. Implement in small Conventional Commits (`feat: …`, `fix: …`, `refactor: …`). Keep refactors in separate commits from behaviour changes.
4. Run `npm run verify` (and `npm run e2e` when UI flows change). Fix, don't skip or weaken checks.
5. Run the **housekeeping** skill: README, AGENTS.md, ADRs, stale comments, dead code, refactoring needs.
6. Self-review with the **code-review** skill / `code-reviewer` agent, then push and open a PR using the template.
7. Merge only when CI is green (branch protection enforces this).

Skills in `.claude/skills/`: `feature-workflow`, `housekeeping`, `adr`, `clean-code`, `refactoring`, `testing`,
`security`, `code-review`. Use them; they define the quality bar.

## Don'ts

- Don't commit secrets or `.env*` files (only `.env.example`). The Supabase anon key is public; the service role key never goes in the client.
- Don't disable lint rules, lower coverage thresholds, or use `any`/`@ts-ignore` to get green. If a rule truly doesn't fit, explain in the PR and add an ADR.
- Don't leave commented-out code, TODOs without an issue, or unused exports.
