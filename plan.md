# Plan: picking up tasks and fixing mistakes

The next iteration. The family can already share, repeat and complete tasks; now members pick up the tasks they'll
do, see their own to-do list, and can fix tasks that were added or completed by mistake. **Replace this file when
the iteration is done.** Tick steps off as their PRs merge.

## How we work through it

- One PR per step (sub-steps are separate PRs), on a branch named after the change (ADR 0001).
- The next step starts after the previous PR is merged. Decisions go into the topic ADRs; this file only tracks order.

## Steps

### 1. Picking up tasks and the Me screen

- [ ] **1a. Pick up and put back** — `pick_up_task()` / `put_back_task()` database functions (household-scoped,
      pgTAP-tested), `picked_up_by` / `picked_up_at` on `tasks`. Decide whether only the person who picked a task up
      can mark it done (ADR 0004).
- [ ] **1b. Board and Me screen** — "Pick up" on the board, which shows who has picked what up. The Me screen gets
      _To do_ (picked-up tasks, soonest due first) and _Completed_ (recently done by me).

### 2. Fixing mistakes

- [ ] Edit a task (title, points, type, due date, repeat), delete a task, and undo "Mark done" shortly after.
      Who may do each (creator or any member) is decided in ADR 0004.

## Backlog (not in this iteration)

- Points for doing and planning, a "Fairness this week" bar, and the Statistics screen.
- Shared family goals and personal rewards (Rewards screen).
- Fewer notifications: batch several new tasks into one, per-user preferences.
- Reuse a previous task when creating one; "last done by …" on cards.
- Leave a household, delete my account (GDPR), password reset by email (needs custom SMTP).
- Child-friendly mode.
