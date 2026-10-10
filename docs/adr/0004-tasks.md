# 0004. Tasks

- **Updated:** 2026-10-10

## Context

A household shares one task board. Adding a task is meta work (planning) and doing it is physical work; both are
credited later, so the data must record who did what and when. Many tasks repeat, and a late task should push the
next one back rather than follow a fixed calendar.

## Decisions

- `tasks` belong to a household: title, optional description (≤ 500 characters), type (`physical`/`meta`),
  points (1–10), `created_by` (from the default, never the client), optional `due_on`, `repeat_every_days`
  (1–365), `completed_at`/`completed_by` and `previous_task_id`. New tasks default to the creator's household.
- **Private tasks**: `is_private` (chosen when adding, never changed; the next occurrence keeps it). The select
  policy shows a private task only to its creator, so the board, "Show completed" and live updates hide it from
  the others, and every security definer function that acts on any open task skips other members' private ones.
  A private task is the creator's own to do: it is listed only in their My tasks (Me page), without picking it up,
  and has no Pick up or Put back. The Shared tasks board and its "Show completed" leave out even the creator's
  own private tasks, and saving or deleting one returns to the Me page (Cancel on the task form goes back to the
  previous page). **Private tasks have no points** (`points` is null exactly when `is_private`, a check
  constraint) and statistics count only shared tasks, both done and created (ADR 0006). A private task whose creator
  deletes their account or leaves stays hidden from everyone.
- **Least privilege**: members can read and insert tasks; every change goes through a function. Marking done uses
  `complete_task(task_id, completed_on)` (security definer). In one transaction it marks an open task in the
  caller's household done and, if it repeats, inserts the **next occurrence**, due
  `completed_on + repeat_every_days`, keeping the original creator. `previous_task_id` is unique: one next
  occurrence per task.
- `completed_on` is the user's local date; the database accepts only the server's date ± 1 day.
- **Picking up**: `pick_up_task()` / `put_back_task()` (security definer) set `picked_up_by` / `picked_up_at` on an
  open task. A task someone has picked up can't be taken by another member (55006); only they can put it back. Anyone
  can still mark any task done (credited to whoever does), so a task left picked up never blocks the family, but
  the app asks first ("Ben has picked this up. Mark it done anyway?").
- **Fixing mistakes**: any member can edit (`update_task()`) or delete (`delete_task()`) an open task; done tasks
  stay as history. Whoever marked a task done can undo it for an hour (`undo_complete_task()`), which also removes
  the next occurrence it created, unless that one is already done.
- **Points**: the Me screen shows the total points of every shared task the user has marked done, summed when read
  (`fetchTotalPoints`), not stored. Adding tasks earns nothing yet. Points also count towards goals (ADR 0007).
- The board (the **Shared tasks** page) shows open shared tasks, soonest due first and tasks without a due date last (newest first within a date).
  It and the Me page's _To do_ group them under headings like an agenda (`groupByDueDate`): Overdue, Today, Tomorrow,
  each of the next five days by date, Later and No due date, leaving out empty groups. Grouping is done in the app
  from the same sorted list, with the user's local date; no calendar grid, which needs far more room on a phone.
  "Show completed" (`?completed=1`, so it survives a reload) adds the household's 30 most recently done shared tasks.
  A **Show** filter (`?show=`, one choice at a time, `taskFilter.ts`) narrows the board to tasks due **Today** or
  **This week** (the next seven days, so it ends where "Later" begins; both include overdue tasks, which still need
  doing), with **No due date**, or **Available** (nobody has picked them up); **All** is the default.
- **Adding a task again**: the New task form suggests earlier tasks from the household's own history, read with
  `task_suggestions()` (security invoker, so RLS hides other members' private tasks): one per title ignoring case,
  with the newest occurrence's details, most often added first (repeats a task adds itself don't count). Typing a
  name lists the matching ones; picking one fills in the form without a due date. There is no templates table:
  deleted tasks drop out on their own, and categories can later filter the same list.
- **Favourites**: before a name is typed, the form offers the household's favourite tasks by name instead of the
  most often added ones, which changed under the user and weren't what they wanted. A star by the name field stars
  or unstars the task being named, also a new one, saved straight away. Favourites are shared by the household:
  any member's star shows for everyone, and any member can remove it. `favourite_tasks` stores only the name
  ignoring case (`title_key`), one row per member who starred it, so a star never reveals a private task: a member
  sees a star they set or one on a task they can see (`private.can_see_favourite()`, which leans on the tasks'
  RLS). The details come from `task_suggestions()`, which returns the 50 most often added tasks plus every
  favourite, so a favourite whose task is deleted isn't offered.
- **Reminders**: a member can ask to be reminded of a task that is theirs to do (their private task or one they
  picked up) at a time they choose, within a year. `task_reminders` (one per task and user) is visible only to its
  owner and written only through `set_task_reminder()` / `clear_task_reminder()`, which check the task is theirs;
  putting a task back removes it. The `send-reminders` Edge Function (ADR 0005) sends due reminders as a push
  notification to the owner's devices, opening My tasks. It takes them with `take_due_reminders()` (service role
  only), which deletes every due reminder and returns those whose task is still theirs and open and that are less
  than an hour late, so a reminder is sent at most once, and not for a task done meanwhile or after an outage. The
  app hides reminders whose time has passed. Reminders aren't copied to a repeating task's next occurrence.
- **Live updates**: `tasks` is in the `supabase_realtime` publication (RLS applies per subscriber). The app
  subscribes once (`subscribeToTaskChanges`) and refetches through TanStack Query on every insert, update or
  delete (deletes aren't filtered by RLS, so they only trigger the refetch). Tasks
  others add show a short message ("Ben added Book dentist"); the next occurrence of a repeating task doesn't.

## Consequences

- Each occurrence is its own row, so history, streaks and statistics come from completed rows.
- Intervals are whole days ("the 1st of every month" isn't possible).

## Alternatives considered

- A calendar recurrence rule (doesn't move with late tasks), reopening the same row (loses who did each
  occurrence), creating the next occurrence from the app (two requests that can half-fail or race).
