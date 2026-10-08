# 0005. Push notifications

- **Updated:** 2026-10-08

## Context

Family members should hear about new tasks when HomeFlow is closed, including on iPhones, where Web Push works only
for apps added to the home screen (iOS 16.4+).

## Decisions

- Standard **Web Push with VAPID** keys, no push provider. The public key is `VITE_VAPID_PUBLIC_KEY`; the private key
  lives only in Supabase Edge Function secrets.
- Each device that turns notifications on (from the Me screen) is a row in `push_subscriptions`, visible only to its
  owner and saved through `save_push_subscription()`, which moves an endpoint to whoever is logged in now. Logging
  out unsubscribes the device.
- The **`notify-household` Edge Function**, called by a Database Webhook on task insert with a shared secret, reads
  the task with the service role and notifies every member except its creator. It skips the next occurrences of
  repeating tasks and forgets subscriptions the push service reports gone (404/410). Its logic is in `notify.ts`
  (unit-tested); `index.ts` is checked with `deno check`.
- A notification says only who added which task and opens the board. `src/sw.ts` shows it; push messages are
  validated by hand (`src/lib/pushNotification.ts`) to keep the worker small.

## Consequences

- Payloads are encrypted to the device; Apple, Google and Mozilla only relay them, but learn a device is notified.
- One-time setup outside the repo: VAPID keys, function deploy and secrets, and the webhook (README).

## Alternatives considered

- Firebase Cloud Messaging or OneSignal (another processor and SDK), sending from the browser (would expose
  other members' subscriptions and the private key).
