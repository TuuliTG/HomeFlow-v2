# AGENTS.md

Instructions for AI coding agents (and humans) working on HomeFlow. `CLAUDE.md` imports this file.

## Project

HomeFlow is a mobile-first PWA for families to share household tasks fairly, crediting both physical work and
meta work (planning, remembering, organising). Product context: [docs/product-brief.md](docs/product-brief.md).
Decisions: [docs/adr/](docs/adr/README.md).

Stack: Vite + React 19 + TypeScript (strict) · React Router · TanStack Query · Tailwind CSS v4 · Zod · Supabase ·
Vitest + Testing Library · Playwright · deployed on Vercel. Node 22 (≥ 22.22.2), 24 (≥ 24.15) or 26+ (`.nvmrc`).

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
| `npm run functions:check`             | Type-check the Deno Edge Function entry points (`deno check`)     |

## Architecture rules

- Feature folders: `src/features/<feature>/` holds its components, hooks, `api.ts` and tests side by side.
  `src/app` = shell/routing/providers, `src/components/ui` = shared presentational components, `src/lib` = infrastructure.
- Features must not import other features' internals; promote shared code to `components/ui` or `lib`. Read the
  logged-in user with `useAuth()` from `@/lib/auth` (`useLoggedInUser()` on screens behind the login, ADR 0003).
  Cross-feature composition (e.g. `OnboardingGate`) lives in `src/app`.
- `src/sw.ts` is the service worker (ADR 0005): WebWorker types via `tsconfig.sw.json`, no React or DOM. It may
  import only `src/lib` modules that don't touch the DOM; put its logic there so it can be unit-tested.
- Errors: a crashed screen is reported by `ErrorPage`; report other errors the app catches but can't handle with
  `reportError()` from `@/lib/monitoring`. Edge Functions report through a `ReportError` dependency, not
  `console.error` (ADR 0002).
- Data access: components → hooks (TanStack Query) → feature `api.ts` → `getSupabaseClient()`. Never call Supabase
  from components (ESLint enforces the import ban). Validate external data with Zod.
- Every Supabase table has Row Level Security enabled with explicit policies. Scope family data with
  `household_id = (select private.current_household_id())` ([ADR 0003](docs/adr/0003-accounts-and-households.md)).
- User-facing text goes in `src/locales/en/` and every other language (`fi`), never inline: read it with
  `useMessages()` from `@/lib/i18n/i18n`, or pass `t: Messages` to helpers (ADR 0002).
- Colours, shadows and fonts come from the theme tokens in `src/index.css` (`bg-page`, `bg-surface`, `text-ink`,
  `text-ink-muted`, `brand-*`, `meta-*`…, ADR 0002), not raw palette classes like `slate-*`.
- Mobile first: design for ~390px wide, then enhance with `md:` breakpoints. Accessible by default (roles, labels, contrast).
- Import with the `@/` alias. Add dependencies with `npm install <pkg>` (exact versions are saved automatically).

## Workflow (always)

1. **Never work on `main`.** Create a branch named in kebab-case after the change, without a type prefix:
   `sort-tasks-by-due-date`, `fix-login-on-ios`. This applies even when a tool or cloud session hands you a generated
   branch name (e.g. `claude/upbeat-edison-wrviz4`): the owner of this repo permits and wants a descriptive branch
   instead. Switch to one before the first push and tell the user which branch you used.
2. Plan briefly; write or update tests first where practical.
3. Implement in small Conventional Commits (`feat: …`, `fix: …`, `refactor: …`). Keep refactors in separate commits from behaviour changes.
4. Run `npm run verify` (and `npm run e2e` when UI flows change). Fix, don't skip or weaken checks.
5. Run the **housekeeping** skill: README, AGENTS.md, ADRs, stale comments, dead code, refactoring needs.
   Decisions go into the few topic ADRs in `docs/adr/` (update the matching one; see its README), kept short.
6. Self-review with the **code-review** skill / `code-reviewer` agent, then push and open a PR using the template.
7. Merge only when CI is green (branch protection enforces this).
8. **Follow-ups go into GitHub issues.** When a task leaves follow-up work (deferred scope, review findings left
   for later, gaps noticed along the way), list them for the user with a proposed title and short description each,
   and create the issues only after the user confirms. Link them from the PR, and reference an issue in any TODO.

Skills in `.claude/skills/`: `feature-workflow`, `housekeeping`, `adr`, `clean-code`, `refactoring`, `testing`,
`security`, `code-review`. Use them; they define the quality bar.

## Don'ts

- Don't commit secrets or `.env*` files (only `.env.example`). The Supabase anon key is public; the service role key never goes in the client.
- Don't disable lint rules, lower coverage thresholds, or use `any`/`@ts-ignore` to get green. If a rule truly doesn't fit, explain in the PR and record it in the matching ADR.
- Don't leave commented-out code, TODOs without an issue, or unused exports.
- Don't add feature status, changelogs or ADR links to `README.md`. Keep it as it is: a short description of the
  app, then tech stack, commands, architecture and services/deployment. Update those sections when they change.
