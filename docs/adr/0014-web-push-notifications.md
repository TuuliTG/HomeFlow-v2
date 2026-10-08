# 0014. Push notifications with Web Push

- **Status:** Accepted
- **Date:** 2026-10-08

## Context

Family members should hear about new tasks when HomeFlow is closed, including on iPhones where it is installed to
the home screen (iOS 16.4+ supports Web Push only for home-screen web apps). Live updates (ADR 0013) only reach
open apps.

## Decision

- Standard **Web Push** with **VAPID** keys; no extra push provider. The public key is `VITE_VAPID_PUBLIC_KEY`;
  the private key lives only in Supabase Edge Function secrets.
- Each device that turns notifications on is a row in `push_subscriptions` (endpoint + encryption keys), visible
  and removable only by its owner. Saving goes through `save_push_subscription()`, which moves an endpoint to the
  user logged in now, so a shared device never notifies a previous user.
- Notifications are sent by a Supabase Edge Function (`notify-household`), triggered by a Database Webhook on task
  insert. It notifies every household member except the creator and deletes subscriptions the push service reports
  as gone (404/410). The webhook sends a shared secret (`x-webhook-secret`) the function checks, since the function
  itself doesn't require a user JWT. Its logic lives in `notify.ts` (unit-tested with Vitest); the Deno entry point
  is type-checked with `deno check`.
- Notifications are turned on per device from the Me screen (permission is asked from the tap). Each app load
  re-saves an existing subscription, so the database matches the browser and the device belongs to whoever is
  logged in; a subscription made with an old VAPID key is dropped. Logging out forgets and unsubscribes the device.
- A notification says only who added which task ("Ben added Book dentist") and opens the task board.
- `vite-plugin-pwa` uses `injectManifest` with our own `src/sw.ts` instead of a generated worker: the same precache
  and `index.html` navigation fallback, updates via `skipWaiting` + `clientsClaim`, plus `push` and
  `notificationclick` handlers. Push messages are checked by hand (`src/lib/pushNotification.ts`) rather than with
  Zod, which would grow the worker about fivefold; links must resolve to the app's own origin.

## Consequences

- Payloads are end-to-end encrypted to the device; Apple, Google or Mozilla push services only relay ciphertext,
  but they are processors that learn a device is being notified.
- Needs one-time setup outside the repo: VAPID keys, Edge Function deploy and secrets, and the webhook (README).
- iPhone users must add HomeFlow to the home screen before they can turn notifications on.
- Anyone logged in who knew a device's endpoint could move it to their account. Endpoints are unguessable URLs
  only the device and its push service know, so this is accepted.

## Alternatives considered

- Firebase Cloud Messaging / OneSignal — another processor and SDK for what the browser already supports.
- Sending from the browser that adds the task — would expose other members' subscriptions and the private key.
