# 0005. Push notifications

- **Updated:** 2026-10-18

## Context

Family members should hear about new tasks when HomeFlow is closed, including on iPhones, where Web Push works only
for apps added to the home screen (iOS 16.4+).

## Decisions

- Standard **Web Push with VAPID** keys, no push provider. The public key is `VITE_VAPID_PUBLIC_KEY`; the private key
  lives only in Supabase Edge Function secrets.
- Each device that turns notifications on (in the settings, behind the gear at the top) is a row in
  `push_subscriptions`, visible only to its owner and saved through `save_push_subscription()`, which moves an
  endpoint to whoever is logged in now. Logging out unsubscribes the device.
- The **`notify-household` Edge Function**, called by a Database Webhook on task insert with a shared secret, reads
  the task with the service role and notifies every member except its creator, and children only of tasks for
  children (ADR 0004). It skips private tasks and the next occurrences of repeating tasks, and forgets subscriptions the push service reports gone (404/410).
- The **`notify-request` Edge Function**, called by a Database Webhook on insert into and update of `task_requests`
  with the same shared secret, tells the member asked who asks them to do which task (opening My tasks), and whoever
  asked whether they accepted or declined (opening the board). It reads the request with the service role and skips
  a request answered or replaced before the webhook arrived.
- The **`send-reminders` Edge Function** sends task reminders (ADR 0004). **Supabase Cron** calls it every minute
  with the same shared secret, so reminders arrive within about a minute of their time.
- The functions use the **service role**, which has only the table privileges migrations grant it
  (`auto_expose_new_tables = false`, like newer cloud projects): reading tasks, members, names and devices, and
  deleting gone devices, and reading task requests. Reminders are taken only through `take_due_reminders()`.
- Each function's logic is in a plain module (`notify.ts`, `notifyRequest.ts`, `remind.ts`), and sending to devices in
  `_shared/push.ts`, all unit-tested; the Deno-only parts (`index.ts`, `_shared/deno/`) are checked with
  `deno check`.
- A notification says only who added which task and opens the board, who asks the user to do which task or how
  they answered, or which task a reminder is for and opens My tasks. `src/sw.ts` shows it; push messages are validated by hand (`src/lib/pushNotification.ts`) to keep the worker small.

## Consequences

- Payloads are encrypted to the device; Apple, Google and Mozilla only relay them, but learn a device is notified.
- One-time setup outside the repo: VAPID keys, function deploys and secrets, the webhook and the cron job (README).
- A reminder is taken before it is sent: if sending fails it is lost rather than sent twice.

## Alternatives considered

- Firebase Cloud Messaging or OneSignal (another processor and SDK), sending from the browser (would expose
  other members' subscriptions and the private key).
