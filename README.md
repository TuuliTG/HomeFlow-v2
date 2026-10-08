# HomeFlow

A mobile-first web app (PWA) that helps families share household tasks fairly. It makes both physical chores and
invisible planning work visible, and motivates through shared goals instead of control.
See [docs/product-brief.md](docs/product-brief.md).

**Status:** development foundation in place (app shell, CI/CD, agent tooling). Log-in uses Supabase Auth with
email and password for now and stores a display name per user ([ADR 0012](docs/adr/0012-email-and-password-login.md)).
After choosing a name, a user creates a household or joins one with its invite code
([ADR 0010](docs/adr/0010-households-and-shared-tasks.md)). The household shares one task board stored in Supabase,
showing who added each task, and updates live while the app is open
([ADR 0013](docs/adr/0013-live-updates-with-realtime.md)). The app requires logging in ([ADR 0011](docs/adr/0011-app-requires-login.md)).
Work in progress is tracked in [plan.md](plan.md).

## Tech stack

Vite · React 19 · TypeScript (strict) · React Router · TanStack Query · Tailwind CSS v4 · Zod · Supabase ·
Vitest + Testing Library · Playwright + axe · vite-plugin-pwa · GitHub Actions · Vercel.
The reasoning behind these choices is in [docs/adr](docs/adr/README.md).

## Getting started

Requires Node ≥ 22.12 (see `.nvmrc`).

```sh
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key (required: log-in and tasks)
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
| `npm run db:test`      | Run database tests (RLS) in `supabase/tests` against local Supabase     |

## Project structure

```
src/app/            shell, routing, providers
src/features/<x>/   feature code: components, hooks, api.ts, tests
src/components/ui/  shared presentational components
src/lib/            infrastructure (env, Supabase client, push message format)
src/sw.ts           service worker: offline cache and push notifications
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

1. **Supabase:** create a project in an **EU region** and copy the Project URL and anon key into `.env.local` and
   Vercel. Then:
   - Apply the migrations: `npx supabase link --project-ref <ref>` and `npx supabase db push`.
   - **Auth → Sign In / Providers → Email:** keep it enabled and turn **off** _Confirm email_ (the app sends no
     email yet, [ADR 0012](docs/adr/0012-email-and-password-login.md)). Set the minimum password length to 8.
   - **Auth → URL Configuration:** set the Site URL to the production URL.
   - **Setting a password** (accounts created with the earlier emailed-code login have none, and there is no reset
     email yet): in the **SQL Editor** run
     `update auth.users set encrypted_password = extensions.crypt('new password', extensions.gen_salt('bf')) where email = 'you@example.com';`
     and share the new password with its owner, who can then log in with it.
   - Accept Supabase's DPA (Organization → Legal documents).
2. **Vercel:** import the GitHub repo and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (real values, for
   both Production and Preview; redeploy after changing them). Build settings and SPA routing come from `vercel.json`.
3. **GitHub → Settings → Branches:** add a protection rule for `main`. Require a pull request, and require these
   status checks to pass: _Lint, format, types, dead code_, _Unit tests_, _Build_, _E2E (Playwright)_,
   _Dependency security_, _Analyze_. Block force pushes.
