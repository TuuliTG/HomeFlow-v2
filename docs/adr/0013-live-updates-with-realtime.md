# 0013. Live updates with Supabase Realtime

- **Status:** Accepted
- **Date:** 2026-10-08

## Context

When one family member adds a task, the others should see it while the app is open, without reloading.

## Decision

- Add `public.tasks` to the `supabase_realtime` publication. Realtime checks each subscriber's Row Level Security,
  so members only receive their own household's tasks; no extra filter or policy is needed.
- The tasks feature subscribes to inserts (`subscribeToNewTasks` in `api.ts`) once, from `TaskActivityToast` in the
  app shell. Each event refetches the task list through TanStack Query, which is the single source of truth; the
  event itself only says which task to announce.
- Tasks added by others show a short message ("Ben added _Book dentist_") in a polite live region that disappears
  after a few seconds; the user's own tasks don't.

## Consequences

- One open WebSocket per app; it reconnects by itself. Updates and deletes are not streamed until tasks can be edited.
- Unit tests fake the subscription (`src/test/fakeTasksApi.ts`); e2e has no Realtime server, so live updates are
  covered by unit tests only.

## Alternatives considered

- Polling the task list — slower, more requests, and drains phones' batteries.
- Building the list from Realtime payloads — duplicates the query's job and misses creator names.
