# 0003. Supabase as backend

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

Families share tasks across devices, so we need auth, a shared database and ideally realtime updates — without running our own server.

## Decision

Use **Supabase** (Postgres, Auth, Realtime). Schema changes are SQL migrations in `supabase/migrations/`. **Row Level Security is enabled on every table.** The browser uses only the public anon key; components never call Supabase directly — feature `api` modules use `getSupabaseClient()` from `src/lib/supabase.ts`.

## Consequences

- Relational model fits families/members/tasks/points well.
- Security depends on correct RLS policies; every table needs policies and tests.
- Local Supabase needs Docker, so unit tests mock the api layer.

## Alternatives considered

- Firebase — NoSQL makes fairness/points aggregation harder.
- Own Node API — more code and hosting to maintain.
