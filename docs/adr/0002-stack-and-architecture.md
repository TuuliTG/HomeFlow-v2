# 0002. Stack and architecture

- **Updated:** 2026-10-20 (few explanatory texts)

## Context

A mobile-first app for families, used mostly on phones and sometimes on laptops, behind a login (no SEO). Built and
maintained by agents, so strict types and a predictable structure matter more than flexibility.

## Decisions

- **Vite + React 19 + TypeScript** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) as a
  single-page app. React Router, TanStack Query for server state, Tailwind CSS v4, Zod for external data,
  `@dnd-kit/core` for drag and drop (mouse and touch, ADR 0004).
- **Supabase** (Postgres, Auth, Realtime, Edge Functions) instead of our own server. Schema changes are SQL
  migrations; **every table has Row Level Security** with explicit policies. The browser has only the anon key.
- **Feature folders**: `src/features/<feature>/` holds components, hooks, `api.ts` and tests; `src/app` the shell,
  routing and cross-feature composition; `src/components/ui` shared presentational components; `src/lib`
  infrastructure. Features don't import each other's internals. Data flows components → hooks → `api.ts` →
  `getSupabaseClient()`; components never call Supabase (ESLint enforces it).
- **PWA** with `vite-plugin-pwa` and our own service worker (`src/sw.ts`), installable to the home screen.
  New versions **wait for the user** (`registerType: 'prompt'`): `UpdateBanner` registers the worker and offers
  "Reload" (or "Not now") once a new version has downloaded. It reloads the page itself when the new worker takes
  control, and checks for a new version whenever the app returns to the foreground and hourly
  (`src/lib/appUpdate.ts`), because iOS resumes Home Screen apps instead of reloading them. An automatic reload
  could lose what someone is typing.
- **Visual design ("Calm Indigo")**: colours, shadows and the font are Tailwind theme tokens in `src/index.css`;
  components use their names (`bg-page`, `bg-surface shadow-card`, `text-ink`, `text-ink-muted`, `brand-*`,
  `meta-*` for meta work, `overdue-*`/`due-today-*` from `dueStatus()`, `points-*`, `done-*`, `danger-*` for errors
  and deleting, `notice-*`, `info-*`, `now`, `confetti-*`), never Tailwind's palette colours, `bg-white` or
  arbitrary colours, so a dark theme ("Night") can redefine them in one place; `src/themeTokens.test.ts` fails on
  those. White text on filled colours and Tailwind's shadows for floating toasts stay. Cards are white with `shadow-card` on a
  tinted page; text on the page uses `ink-muted` or darker for AA contrast. The **Figtree** font is self-hosted
  with `@fontsource-variable/figtree` and precached by the service worker, so it works offline.
- **Vercel** hosts the static build.
- **Languages** (English and Finnish) without an i18n library: each language is a typed object in
  `src/locales/<code>/`, one file per area, with English (`src/locales/en`) as the source and its type
  `Messages`. Texts that take values are functions, so plurals, word order and date formats (`common.shortDate`,
  `common.time`) live with the language. Components read texts with `useMessages()` from `@/lib/i18n/i18n`;
  helpers that build text take `t: Messages` (e.g. `groupByDueDate`, `newTaskSchema(t)`). The language is the one
  chosen in the settings (stored per device in `localStorage`), else the browser's, else English; `<html lang>`
  follows it. Adding one: copy `src/locales/en`, translate, register it in `src/lib/i18n/languages.ts`.
  Screens speak through headings, labels and buttons: no page descriptions or field hints unless a rule isn't
  obvious from the screen (e.g. a password's length), and none on children's screens.

- **Error monitoring with Sentry** (EU region, free plan), on only where a DSN is set. The app loads the SDK
  lazily from `startMonitoring()` (`src/lib/monitoring.ts`) and sends no user info, cookies, headers, bodies or
  query strings. A route that crashes shows `ErrorPage` (the `errorElement` inside `LanguageProvider`), which calls
  `reportError()`. The Edge Functions report through `_shared/deno/monitoring.ts`; their pure halves take a
  `ReportError` dependency instead of calling `console.error`. Builds with `SENTRY_AUTH_TOKEN` upload hidden
  source maps and then delete them. No tracing or session replay.

## Consequences

- TypeScript fails the build when a language is missing a text or gives a function the wrong shape. Unit tests
  without `LanguageProvider` see English. Push notification texts are built server-side and are still English.
- No servers to run; the free tiers are enough for now. Sentry's free plan allows about 5k errors a month.
- Security rests on RLS policies, so each one needs pgTAP tests.
- No SSR; the service worker's cache must be kept in mind when debugging stale content. A deploy shows up
  after a tap on Reload, or once every HomeFlow window is closed.

## Alternatives considered

- Next.js (SSR not needed), React Native (app stores not needed), Firebase (NoSQL makes points and fairness
  queries harder), own Node API (more to host and secure).
- Supabase and Vercel logs alone for monitoring: no alerts, and nothing from users' browsers.
- i18next with JSON files for languages: a dependency and string keys that need extra setup to type-check, more
  than a few hundred short texts need. Worth revisiting if translators need a translation service.
