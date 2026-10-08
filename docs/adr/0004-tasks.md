# 0004. Tasks

- **Updated:** 2026-10-08

## Context

A household shares one task board. Adding a task is planning work and doing it is physical work; both are credited
later, so the data must record who did what and when. Many tasks repeat, and a late task should push the next one
back rather than follow a fixed calendar.

## Decisions

- `tasks` belong to a household: title, type (`physical`/`planning`), points (1–10), `created_by` (from the default,
  never the client), optional `due_on`, `repeat_every_days` (1–365), `completed_at`/`completed_by` and
  `previous_task_id`. New tasks default to the creator's household.
- **Least privilege**: members can read and insert tasks; every change goes through a function. Marking done uses
  `complete_task(task_id, completed_on)` (security definer). In one transaction it marks an open task in the
  caller's household done and, if it repeats, inserts the **next occurrence**, due
  `completed_on + repeat_every_days`, keeping the original creator. `previous_task_id` is unique: one next
  occurrence per task.
- `completed_on` is the user's local date; the database accepts only the server's date ± 1 day.
- **Picking up**: `pick_up_task()` / `put_back_task()` (security definer) set `picked_up_by` / `picked_up_at` on an
  open task. A task someone has picked up can't be taken by another member (55006); only they can put it back. Anyone
  can still mark any task done (credited to whoever does), so a task left picked up never blocks the family.
- The board shows open tasks, soonest due first and tasks without a due date last (newest first within a date).
- **Live updates**: `tasks` is in the `supabase_realtime` publication (RLS applies per subscriber). The app
  subscribes once (`subscribeToTaskChanges`) and refetches through TanStack Query on every insert or update. Tasks
  others add show a short message ("Ben added Book dentist"); the next occurrence of a repeating task doesn't.

## Consequences

- Each occurrence is its own row, so history, streaks and statistics come from completed rows.
- Tasks can't be edited, un-done or deleted yet.
- Intervals are whole days ("the 1st of every month" isn't possible).

## Alternatives considered

- A calendar recurrence rule (doesn't move with late tasks), reopening the same row (loses who did each
  occurrence), creating the next occurrence from the app (two requests that can half-fail or race).
