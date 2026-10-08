# Plan: shared tasks and notifications

Working plan for making tasks shared within a family and notifying the others when something changes (e.g. a new
task). **Delete this file in the last PR of the plan.** Tick steps off as their PRs merge.

## Goal

When one family member adds a task, the others see it — live if the app is open, and as a push notification on their
phone (including an iPhone with HomeFlow installed to the home screen) if it isn't.

## How we work through it

- **One PR per step** (sub-steps are separate PRs too). Each PR follows `AGENTS.md`: tests first, `npm run verify`,
  `npm run e2e` when a flow changes, `npm run db:test` when the schema changes, housekeeping, self-review.
- The next step starts only after the previous PR is merged, so each one is reviewed and testable on its own
  (Vercel preview + local Supabase).
- Decisions that come up along the way get an ADR; this file only tracks the order of work.

## Steps

### 1. Shared, persisted tasks

Before this step, tasks lived in memory on one device and there was no notion of a family.

- [x] **1a. Data model** — `households`, `household_members` and `tasks` tables with Row Level Security; create/join a
      household through database functions with an invite code; household members can see each other's display
      names. pgTAP tests for every policy. ADR 0010. _(Done: merged, and the migration is applied to the
      Supabase project.)_
- [x] **1b. Household UI** — after choosing a display name, a logged-in user without a household either creates one
      (name) or joins one (invite code). A household screen shows the invite code to share and the member names.
      New `src/features/household/` feature with `api.ts` + TanStack Query hooks; unit tests with a faked api;
      e2e flow with `e2e/fakeSupabase.ts`.
- [x] **1c. Tasks in Supabase** — `src/features/tasks/api.ts` + query/mutation hooks replace the in-memory
      `TasksProvider`. Tasks show who created them. Logged-out visitors and users without a household are guided
      to log in / set up a household instead of seeing an empty board. Update unit tests, e2e and README status.
      Decided: no logged-out "try it out" mode ([ADR 0011](docs/adr/0011-app-requires-login.md)).

### 2. Live updates while the app is open

- [x] Enable Supabase Realtime for `tasks` (migration adding it to the `supabase_realtime` publication; RLS still
      applies). A hook subscribes to inserts for the user's household and refreshes the task list, with a short
      non-intrusive message ("Anna added _Book dentist_"). Tests with a faked subscription.
      ([ADR 0013](docs/adr/0013-live-updates-with-realtime.md))

### 3. Push notifications when the app is closed (Web Push)

- [x] **3a. Subscriptions storage** — ADR for Web Push (VAPID, Supabase Edge Function, what goes in a notification).
      `push_subscriptions` table (endpoint + keys per device, owner-only RLS) with pgTAP tests.
- [ ] **3b. Service worker** — switch `vite-plugin-pwa` to `injectManifest` keeping today's caching, and add `push`
      (show notification) and `notificationclick` (open/focus the task board) handlers.
- [ ] **3c. Turn notifications on** — a settings control that asks permission from a tap, subscribes with the
      public VAPID key (`VITE_VAPID_PUBLIC_KEY`) and saves the subscription; turning off removes it. On iOS, explain
      that HomeFlow must first be added to the home screen.
- [ ] **3d. Sending** — Edge Function `notify-household` triggered by a Database Webhook on task insert: sends to
      every household member except the creator, removes subscriptions the push service reports as gone (404/410).
      VAPID private key only in Edge Function secrets. README gets the one-time setup steps.
- [ ] **3e. Less noise** _(optional, decide after trying 3d)_ — batch several tasks added in a short time into one
      notification and/or per-user preferences.

### 4. iPhone polish

- [ ] One-time "Add to Home Screen" hint on iOS Safari when not running standalone; status bar style and launch
      screen meta tags.

## Open questions

- Should leaving a household / switching households be possible? (Not needed for 1–3; a user is in at most one.)
