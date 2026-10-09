# 0004. Tasks

- **Updated:** 2026-10-09

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
  A private task is the creator's own to do: it is listed in their My tasks without picking it up, and has no
  Pick up or Put back. **Private tasks have no points** (`points` is null exactly when `is_private`, a check
  constraint) and statistics count only shared tasks, both done and created. A private task whose creator
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
  (`fetchTotalPoints`), not stored. Adding tasks earns nothing yet; points per period come later.
- The board shows open tasks, soonest due first and tasks without a due date last (newest first within a date).
  "Show completed" (`?completed=1`, so it survives a reload) adds the household's 30 most recently done tasks.
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
