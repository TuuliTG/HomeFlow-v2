# 0005. Push notifications

- **Updated:** 2026-11-02 (choosing which notifications to get; done shared tasks)

## Context

Family members should hear about new tasks when HomeFlow is closed, including on iPhones, where Web Push works only
for apps added to the home screen (iOS 16.4+).

## Decisions

- Standard **Web Push with VAPID** keys, no push provider. The public key is `VITE_VAPID_PUBLIC_KEY`; the private key
  lives only in Supabase Edge Function secrets.
- Each device that turns notifications on (in the settings, behind the gear at the top) is a row in
  `push_subscriptions`, visible only to its owner and saved through `save_push_subscription()`, which moves an
  endpoint to whoever is logged in now. Logging out unsubscribes the device.
- The **`notify-household` Edge Function**, called by a Database Webhook on task insert and update with a shared
  secret, reads the task with the service role. For a new task it notifies every member except its creator, and
  children only of tasks for children (ADR 0004), skipping the next occurrences of repeating tasks. For an update
  that marks a task done (`completed_at` null in `old_record`, set in `record`) it tells the other adults who did
  it, opening News to praise it (children have no News, ADR 0008). Other updates are ignored from the payload, and
  a task undone before the function reads it sends nothing. Private tasks never notify anyone. Subscriptions the
  push service reports gone (404/410) are forgotten.
- The **`notify-request` Edge Function**, called by a Database Webhook on insert into and update of `task_requests`
  with the same shared secret, tells the member asked who asks them to do which task (opening My tasks), and whoever
  asked whether they accepted or declined (opening the board). It reads the request with the service role and skips
  a request answered or replaced before the webhook arrived.
- The **`send-reminders` Edge Function** sends task reminders (ADR 0004). **Supabase Cron** calls it every minute
  with the same shared secret, so reminders arrive within about a minute of their time.
- **Choosing what to get:** `notification_preferences` holds one row per user, with a boolean per kind
  (`task_added`, `task_completed`, `task_requested`, `request_answered`, `reminder`), for all their devices; no row
  means every kind is on. Users read and upsert only their own row (RLS). Settings shows the choices while this
  device's notifications are on (without `task_completed` for children). `pushToUsers()` takes the kind and skips
  the members who turned it off, so every function respects the choices in one place.
- The functions use the **service role**, which has only the table privileges migrations grant it
  (`auto_expose_new_tables = false`, like newer cloud projects): reading tasks, members, names and devices, and
  deleting gone devices, reading task requests and notification preferences. Reminders are taken only through `take_due_reminders()`.
- Each function's logic is in a plain module (`notify.ts`, `notifyRequest.ts`, `remind.ts`), and sending to devices in
  `_shared/push.ts`, all unit-tested; the Deno-only parts (`index.ts`, `_shared/deno/`) are checked with
  `deno check`.
- A notification says only who added which task and opens the board, who did which task and opens News, who asks the user to do which task or how
  they answered, or which task a reminder is for and opens My tasks. `src/sw.ts` shows it; push messages are validated by hand (`src/lib/pushNotification.ts`) to keep the worker small.

## Consequences

- Payloads are encrypted to the device; Apple, Google and Mozilla only relay them, but learn a device is notified.
- One-time setup outside the repo: VAPID keys and function secrets, the webhook and the cron job (README).
  Functions deploy with the `Deploy database` workflow.
- A reminder is taken before it is sent: if sending fails it is lost rather than sent twice.
- The tasks webhook now runs on every task update (each pick-up, edit and live-refresh touch); the function drops
  those after parsing the payload, so they cost only an invocation.
- A task marked done and undone within the hour still sent "did"; adding a task as "Already done" (ADR 0004)
  sends both "added" and "did".

## Alternatives considered

- Firebase Cloud Messaging or OneSignal (another processor and SDK), sending from the browser (would expose
  other members' subscriptions and the private key).
