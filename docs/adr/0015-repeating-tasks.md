# 0015. Due dates, marking tasks done and repeating tasks

- **Status:** Accepted
- **Date:** 2026-10-08

## Context

Many household tasks come back regularly: the bed linen is changed about every two weeks. A fixed calendar
("every other Monday") goes wrong as soon as a task is late: the next one would be due a few days after the late
one was finally done. The interval should run from when the task was actually done. Tasks couldn't be marked done
before this, so completing a task is part of this decision.

## Decision

- `tasks` gets `repeat_every_days` (1–365, null for a one-off task), an optional `due_on` date, `completed_at`,
  `completed_by` and `previous_task_id`. The board shows open tasks only.
- A task is marked done only through `complete_task(task_id, completed_on)` (security definer). Members still have
  no `update` grant. In one transaction it marks an open task in the caller's household done and, if the task
  repeats, inserts its **next occurrence**: same title, type, points and interval, due `completed_on +
repeat_every_days`, with `previous_task_id` pointing at the one just done. `previous_task_id` is unique, so a
  task has at most one next occurrence, and the row lock makes a second simultaneous completion fail (P0002).
- `completed_on` is the user's local date, sent by the app, because a due date is a calendar date where the family
  lives. The database only accepts the server's date ± 1 day, which covers every time zone.
- The next occurrence keeps the original `created_by`: the planning credit stays with whoever set up the routine.
  Because it isn't new planning work, it is neither announced live nor sent as a push notification.
- Anyone in the household can mark any open task done. Picking up tasks first and points for doing them come later.

## Consequences

- Each occurrence is its own row, so history ("last done by …", streaks, statistics) can be read from completed
  rows and the `previous_task_id` chain without a separate history table.
- Task changes are now streamed live (inserts and updates), so a task someone marks done leaves everyone's board.
- Intervals are whole days. Use 7 or 30 days for weekly or monthly tasks; "the 1st of every month" isn't supported.
- A task can't be un-done or edited yet; mistakes need an edit feature with its own policy.

## Alternatives considered

- A recurrence rule (RRULE) on a fixed calendar: doesn't move with late tasks, which is the point here.
- Re-opening the same row with a new due date: loses who did each occurrence and when.
- Creating the next occurrence in the app after marking done: two requests that can half-fail and race between
  members. One database function keeps them atomic.
