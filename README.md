# HomeFlow

A mobile-first web app (PWA) that helps families share household tasks fairly. It credits both physical chores and
the invisible meta work behind them (planning, remembering, organising), and motivates through shared goals and
rewards instead of control. The app is available in English and Finnish.

## Tech stack

| Area         | Technology                                                                  |
| ------------ | --------------------------------------------------------------------------- |
| App          | Vite · React 19 · TypeScript (strict) · React Router                        |
| Data & state | TanStack Query · Zod (validation of external data)                          |
| Styling      | Tailwind CSS v4                                                             |
| PWA          | vite-plugin-pwa · custom service worker (offline, push)                     |
| Backend      | Supabase (Postgres with Row Level Security, Auth, Edge Functions, Realtime) |
| Testing      | Vitest · Testing Library · Playwright + axe                                 |
| Quality      | ESLint · Prettier · knip                                                    |
| CI & hosting | GitHub Actions · Vercel                                                     |

## Getting started

Requires Node ≥ 22.12 (see `.nvmrc`).

```sh
npm install
cp .env.example .env.local   # fill in the Supabase URL and anon key
npm run dev
```

## Commands

| Command                       | What it does                                                            |
| ----------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                 | Start the dev server                                                    |
| `npm run build`               | Type-check and build for production                                     |
| `npm run preview`             | Serve the production build locally                                      |
| `npm run verify`              | Format check, lint, typecheck, dead-code check, tests + coverage, build |
| `npm run lint`                | Lint (`lint:fix` to auto-fix)                                           |
| `npm run format`              | Format with Prettier (`format:check` to only check)                     |
| `npx prettier --write <path>` | Format one file or folder                                               |
| `npm run typecheck`           | TypeScript type check                                                   |
| `npm run knip`                | Find unused files, exports and dependencies                             |
| `npm test`                    | Unit/component tests (`test:watch` for watch mode, `test:coverage`)     |
| `npm run e2e`                 | Playwright e2e on mobile + desktop (first run `npm run e2e:install`)    |
| `npm run db:start`            | Start local Supabase (requires Docker; `db:stop` to stop)               |
| `npm run db:reset`            | Reset the local database and apply all migrations                       |
| `npm run db:migration`        | Create a new SQL migration                                              |
| `npm run db:test`             | Run database (RLS) tests in `supabase/tests` against local Supabase     |
| `npm run functions:check`     | Type-check the Supabase Edge Functions with Deno                        |

The database tests need [Docker](https://docs.docker.com/get-started/get-docker/) running. For just the database,
like CI does:

```sh
npx supabase db start   # database with all migrations applied
npm run db:test
npm run db:stop
```

## Architecture

```
src/app/            shell, routing, providers
src/features/<x>/   feature code: components, hooks, api.ts, tests
src/components/ui/  shared presentational components
src/lib/            infrastructure (env, Supabase client, auth, i18n, push message format)
src/locales/<lang>/ the app's texts, one folder per language (English is the source)
src/sw.ts           service worker: offline cache and push notifications
e2e/                Playwright specs
supabase/           config, SQL migrations, database tests, Edge Functions
```

- **Data flow:** components → hooks (TanStack Query) → feature `api.ts` → Supabase client. Components never call
  Supabase directly, and external data is validated with Zod.
- **Security:** every table has Row Level Security; family data is scoped to the user's household.
- **Edge Functions** (Deno): `add-child` and `child-sign-in` for children without email, `notify-household` and
  `send-reminders` for push notifications.
- **Texts** live in `src/locales/`, never inline in components.

Conventions for contributors and AI agents are in [AGENTS.md](AGENTS.md).

## Services and deployment

- **Supabase** hosts the database, authentication (email + password) and Edge Functions.
- **Vercel** builds the app (settings and SPA routing in `vercel.json`) and deploys `main` to production and every
  PR to a preview URL.
- **GitHub Actions** runs lint, types, dead-code check, unit, database and e2e tests, dependency audit and CodeQL on
  every PR. `main` is protected and only accepts changes through a PR with green CI.

### Environment variables

| Variable                 | Where                | Purpose                                               |
| ------------------------ | -------------------- | ----------------------------------------------------- |
| `VITE_SUPABASE_URL`      | `.env.local`, Vercel | Supabase project URL                                  |
| `VITE_SUPABASE_ANON_KEY` | `.env.local`, Vercel | Supabase anon key (public; access is enforced by RLS) |
| `VITE_VAPID_PUBLIC_KEY`  | `.env.local`, Vercel | Optional; enables push notifications                  |

### One-time setup

1. **Supabase:** create a project in an EU region.
   - Apply the migrations: `npx supabase link --project-ref <ref>` and `npx supabase db push`.
   - **Auth → Sign In / Providers → Email:** keep it enabled, turn off _Confirm email_ and set the minimum password
     length to 8. **Auth → URL Configuration:** set the Site URL to the production URL.
   - Deploy the child-account functions: `npx supabase functions deploy add-child child-sign-in`.
   - Accept Supabase's DPA (Organization → Legal documents).
2. **Vercel:** import the GitHub repo and set the environment variables above for Production and Preview.
3. **GitHub → Settings → Branches:** protect `main`, require a PR and the CI status checks, block force pushes.
4. **Push notifications** (optional):
   1. Generate VAPID keys: `npx web-push@3.6.7 generate-vapid-keys`. Set `VITE_VAPID_PUBLIC_KEY` in Vercel.
   2. **Supabase → Edge Functions → Secrets:** add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
      (`mailto:` + your email) and `NOTIFY_WEBHOOK_SECRET` (e.g. `openssl rand -hex 32`).
   3. Deploy: `npx supabase functions deploy notify-household send-reminders`.
   4. **Supabase → Database Webhooks:** on insert into `tasks`, call the `notify-household` function (POST) with
      header `x-webhook-secret` set to the secret.
   5. **Supabase → Integrations → Cron:** every minute (`* * * * *`), call the `send-reminders` function (POST)
      with the same `x-webhook-secret` header.
   6. In the app, turn on notifications on each device (on iPhone, add HomeFlow to the Home Screen first).
