# HomeFlow

A mobile-first web app (PWA) that helps families share household tasks fairly. It makes both physical chores and
invisible planning work visible, and motivates through shared goals instead of control.
See [docs/product-brief.md](docs/product-brief.md).

**Status:** development foundation in place (app shell, CI/CD, agent tooling). Features come next.

## Tech stack

Vite · React 19 · TypeScript (strict) · React Router · TanStack Query · Tailwind CSS v4 · Zod · Supabase ·
Vitest + Testing Library · Playwright + axe · vite-plugin-pwa · GitHub Actions · Vercel.
The reasoning behind these choices is in [docs/adr](docs/adr/README.md).

## Getting started

Requires Node ≥ 22.12 (see `.nvmrc`).

```sh
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key (only needed once features use data)
npm run dev
```

| Command                | What it does                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| `npm run dev`          | Start the dev server                                                    |
| `npm run verify`       | Format check, lint, typecheck, dead-code check, tests + coverage, build |
| `npm test`             | Unit/component tests (`test:watch` for watch mode)                      |
| `npm run e2e`          | Playwright e2e on mobile + desktop (first run `npm run e2e:install`)    |
| `npm run knip`         | Find unused files, exports and dependencies                             |
| `npm run db:start`     | Local Supabase (requires Docker)                                        |
| `npm run db:migration` | Create a new SQL migration                                              |

## Project structure

```
src/app/            shell, routing, providers
src/features/<x>/   feature code: components, hooks, api.ts, tests
src/components/ui/  shared presentational components
src/lib/            infrastructure (env, Supabase client)
e2e/                Playwright specs
supabase/           Supabase config and SQL migrations
docs/               product brief, ADRs, cloud workflow guide
.claude/            agent settings, hooks, skills, reviewer agent
```

## Workflow

All changes go through a branch and a PR. `main` only receives changes after CI passes, and Vercel deploys `main` to
production and every PR to a preview URL. Details are in [AGENTS.md](AGENTS.md) and [ADR 0008](docs/adr/0008-branch-pr-workflow.md).

- **AI agents:** `AGENTS.md` (loaded by Claude Code through `CLAUDE.md`) plus the skills in `.claude/skills/`.
- **From your phone:** [docs/claude-cloud.md](docs/claude-cloud.md).

## One-time hosting setup

1. **Supabase:** create a project and copy the Project URL and anon key into `.env.local` and Vercel.
2. **Vercel:** import the GitHub repo (framework preset: Vite) and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. **GitHub → Settings → Branches:** add a protection rule for `main`. Require a pull request, and require these
   status checks to pass: _Lint, format, types, dead code_, _Unit tests_, _Build_, _E2E (Playwright)_,
   _Dependency security_, _Analyze_. Block force pushes.
