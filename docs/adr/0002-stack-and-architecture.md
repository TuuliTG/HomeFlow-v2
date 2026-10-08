# 0002. Stack and architecture

- **Updated:** 2026-10-08

## Context

A mobile-first app for families, used mostly on phones and sometimes on laptops, behind a login (no SEO). Built and
maintained by agents, so strict types and a predictable structure matter more than flexibility.

## Decisions

- **Vite + React 19 + TypeScript** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) as a
  single-page app. React Router, TanStack Query for server state, Tailwind CSS v4, Zod for external data.
- **Supabase** (Postgres, Auth, Realtime, Edge Functions) instead of our own server. Schema changes are SQL
  migrations; **every table has Row Level Security** with explicit policies. The browser has only the anon key.
- **Feature folders**: `src/features/<feature>/` holds components, hooks, `api.ts` and tests; `src/app` the shell,
  routing and cross-feature composition; `src/components/ui` shared presentational components; `src/lib`
  infrastructure. Features don't import each other's internals. Data flows components → hooks → `api.ts` →
  `getSupabaseClient()`; components never call Supabase (ESLint enforces it).
- **PWA** with `vite-plugin-pwa` and our own service worker (`src/sw.ts`), installable to the home screen.
- **Vercel** hosts the static build.

## Consequences

- No servers to run; the free tiers are enough for now.
- Security rests on RLS policies, so each one needs pgTAP tests.
- No SSR; the service worker's cache must be kept in mind when debugging stale content.

## Alternatives considered

- Next.js (SSR not needed), React Native (app stores not needed), Firebase (NoSQL makes points and fairness
  queries harder), own Node API (more to host and secure).
