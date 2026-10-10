# HomeFlow

A mobile-first web app (PWA) that helps families share household tasks fairly. It makes both physical chores and
invisible meta work visible, and motivates through shared goals instead of control.
See [docs/product-brief.md](docs/product-brief.md).

**Status:** a family logs in with email and password, creates or joins a household with an invite code and shares
one task board ([ADR 0003](docs/adr/0003-accounts-and-households.md)). Members pick up tasks (listed on their Me
screen with what they've completed and their total points); tasks can have a due date, be private, be edited,
deleted, marked done (and undone), repeat a set number of days after they were done and be added again from earlier
tasks (private ones are listed only on the Me screen); the board and the Me screen group tasks by when they are
due (overdue, today, tomorrow, the next five days by date, later, no due date); the Shared tasks board updates live and members can get push notifications, including reminders they set for their
own tasks ([ADR 0004](docs/adr/0004-tasks.md), [ADR 0005](docs/adr/0005-push-notifications.md)).
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

### Running the database tests locally

CI runs these on every PR (job _Database (migrations + RLS)_), so running them yourself is optional. They need
[Docker](https://docs.docker.com/get-started/get-docker/) running (e.g. Docker Desktop); the Supabase CLI starts
its own containers, you don't create any.

```sh
npx supabase db start   # just the database (with all migrations applied), like CI
npm run db:test         # runs supabase/tests/*.test.sql against it
npm run db:stop         # when you're done
```

`npm run db:start` starts the whole local Supabase instead. The first start downloads the Supabase images and takes
a few minutes. After you add or change a migration, run `npm run db:reset` so the local database picks it up.

## Project structure

```
src/app/            shell, routing, providers
src/features/<x>/   feature code: components, hooks, api.ts, tests
src/components/ui/  shared presentational components
src/lib/            infrastructure (env, Supabase client, push message format)
src/sw.ts           service worker: offline cache and push notifications
e2e/                Playwright specs
supabase/           Supabase config, SQL migrations and tests, Edge Functions
docs/               product brief, ADRs, cloud workflow guide
.claude/            agent settings, hooks, skills, reviewer agent
```

## Workflow

All changes go through a branch and a PR. `main` only receives changes after CI passes, and Vercel deploys `main` to
production and every PR to a preview URL. Details are in [AGENTS.md](AGENTS.md) and [ADR 0001](docs/adr/0001-how-we-work.md).

- **AI agents:** `AGENTS.md` (loaded by Claude Code through `CLAUDE.md`) plus the skills in `.claude/skills/`.
- **From your phone:** [docs/claude-cloud.md](docs/claude-cloud.md).

## One-time hosting setup

1. **Supabase:** create a project in an **EU region** and copy the Project URL and anon key into `.env.local` and
   Vercel. Then:
   - Apply the migrations: `npx supabase link --project-ref <ref>` and `npx supabase db push`.
   - **Auth → Sign In / Providers → Email:** keep it enabled and turn **off** _Confirm email_ (the app sends no
     email yet, [ADR 0003](docs/adr/0003-accounts-and-households.md)). Set the minimum password length to 8.
   - **Auth → URL Configuration:** set the Site URL to the production URL.
   - **Setting a password** (accounts created with the earlier emailed-code login have none, and there is no reset
     email yet): in the **SQL Editor** run
     `update auth.users set encrypted_password = extensions.crypt('new password', extensions.gen_salt('bf')) where email = 'you@example.com';`
     and share the new password with its owner, who can then log in with it.
   - Accept Supabase's DPA (Organization → Legal documents).
2. **Vercel:** import the GitHub repo and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (real values, for
   both Production and Preview; redeploy after changing them). Optionally add `VITE_VAPID_PUBLIC_KEY` to show the
   notifications setting ([ADR 0005](docs/adr/0005-push-notifications.md)); sending also needs step 4. Build
   settings and SPA routing come from `vercel.json`.
3. **GitHub → Settings → Branches:** add a protection rule for `main`. Require a pull request, and require these
   status checks to pass: _Lint, format, types, dead code_, _Unit tests_, _Build_, _E2E (Playwright)_,
   _Dependency security_, _Analyze_. Block force pushes.
4. **Push notifications** (optional, [ADR 0005](docs/adr/0005-push-notifications.md)):
   1. Create a VAPID key pair on your own computer: `npx web-push@3.6.7 generate-vapid-keys`. Keep the private key secret.
   2. **Vercel:** set `VITE_VAPID_PUBLIC_KEY` to the public key and redeploy.
   3. **Supabase → Edge Functions → Secrets:** add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
      (`mailto:` plus your email; push services use it to reach you) and `NOTIFY_WEBHOOK_SECRET` (a long random
      string, e.g. from `openssl rand -hex 32`).
   4. Deploy the functions (uses the project linked in step 1, or add `--project-ref <ref>`):
      `npx supabase functions deploy notify-household send-reminders`. Their settings come from
      `supabase/config.toml`; without the secrets from step 3 they answer every call with an error.
   5. **Supabase → Database → Webhooks** (newer dashboards: **Integrations → Database Webhooks**; enable webhooks
      once if asked) **→ Create:** table `tasks`, event _Insert_, type _Supabase Edge Functions_, function
      `notify-household`, method POST, timeout at its maximum, and an HTTP header `x-webhook-secret` with the same
      secret. Don't add the service-key auth header: the function doesn't need it.
   6. **Supabase → Integrations → Cron** (enable it once if asked) **→ Create job:** name `send-reminders`,
      schedule every minute (`* * * * *`), type _Supabase Edge Function_, method POST, function `send-reminders`,
      and an HTTP header `x-webhook-secret` with the same secret. This sends task reminders.
   7. In the app: Me → _Turn on notifications_ on each device. On iPhone, add HomeFlow to the Home Screen first.
