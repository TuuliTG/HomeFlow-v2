# Plan: fair share — picking up tasks, points and fairness

The next iteration. The family can already share, repeat and complete tasks; now HomeFlow should show **who does and
who plans** the work, which is the core of the product brief. **Replace this file when the iteration is done.**
Tick steps off as their PRs merge.

## Goal

Members pick up tasks and see their own to-do list, earn points for both doing and planning, and the family sees how
the work is shared this week — positive and low effort, never a scoreboard of blame.

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

### 3. Points

- [ ] **3a. Rules and data** — new ADR "Points and fairness": doing a task earns its points (`completed_by`),
      planning earns points for the creator (amount to decide). Points are computed from tasks (view or function per
      member and period) rather than stored separately, unless that proves too slow.
- [ ] **3b. Feedback** — a short, positive "+3 points" message when creating or completing a task.

### 4. Fairness this week

- [ ] A "Fairness this week" bar on the board: each member's share, split into done and planned.

### 5. Statistics screen

- [ ] Week / month selector, done vs. created per member, and a simple fairness label ("Balanced", "Uneven")
      instead of a ranking.

## Backlog (not in this iteration)

- Shared family goals and personal rewards (Rewards screen).
- Fewer notifications: batch several new tasks into one, per-user preferences.
- Reuse a previous task when creating one; "last done by …" on cards.
- Leave a household, delete my account (GDPR), password reset by email (needs custom SMTP).
- Child-friendly mode.

## Open questions

- How many points does planning earn: a fixed amount, or a share of the task's points?
- Bonus for tasks someone hasn't done recently, fewer points for always repeating the same task (product brief)?
- Should points reset (weekly/monthly), or only the views change period?
