# 0007. Goals and rewards

- **Updated:** 2026-10-10

## Context

Points should motivate without becoming a contest or a currency to manage. Families want shared goals they reach
together, and members want small personal goals of their own; both must make clear how points accumulate.

## Decisions

- `goals` (household, `title` = the reward ≤ 80 characters, `target_points` 1–10 000, `owner_id`, `created_by`,
  `claimed_at`/`claimed_by`). **`owner_id` null is a family goal**: everyone's points count and the whole household
  sees it. Otherwise it is the owner's **personal goal**: only their points count and only they see it (select
  policy), like a private task. Nobody sets a personal goal for someone else (insert policy).
- **Progress is counted, not stored**: `private.goal_points(goal)` sums the points of shared tasks done from the
  goal's `created_at` until it was claimed (by its owner for a personal goal). `household_goals()` (security
  invoker) returns the visible goals with their points, open ones first (newest first), then claimed ones.
- **Points aren't spent**: the same points count towards every goal they apply to, so there is no balance to
  reset or argue about, and setting a new goal starts it from zero.
- **Claiming**: `claim_goal_reward(goal_id)` (security definer) claims an open, reached goal the user can see, once
  (row lock); any member can claim a family goal. Claimed goals stay as history ("Rewards claimed") and can't be
  deleted; members delete open goals they can see directly (delete policy). Undoing a task after a claim doesn't
  unclaim it.
- The Rewards screen refetches goals when it opens (TanStack Query default), so tasks done elsewhere show up; no
  live updates for goals.

## Consequences

- Goals can't be edited yet (delete and set a new one); there are no goals for someone else, e.g. a parent for
  a child.

## Alternatives considered

- A points balance that rewards spend (needs a ledger and a reset policy, and invites competition); storing
  progress on the goal (drifts when tasks are undone or edited).
