# 0007. Goals and rewards

- **Updated:** 2026-10-15 (celebrating a claimed reward)

## Context

Points should motivate without becoming a contest or a currency to manage. Families want shared goals they reach
together, and members want small personal goals of their own; both must make clear how points accumulate.

## Decisions

- `goals` (household, `title` = the reward ≤ 80 characters, `target_points` 1–10 000, `owner_id`, `created_by`,
  `claimed_at`/`claimed_by`). **`owner_id` null is a shared goal** for the members in `goal_participants` (the whole
  family, or e.g. two siblings): only their points count, and they claim it. Otherwise it is the owner's **personal
  goal**: only their points count and only the owner claims it. **The whole household sees every goal** (with the
  owner's name or the participants), so the family can follow and celebrate.
- **Only adults add and delete goals** (insert and delete policies, ADR 0003), so children's rewards are the
  parents' call. An adult can set a personal goal for any member of the household, e.g. a child; the child still
  claims it. Shared goals are added only by `add_shared_goal(title, target_points, participants)` (security
  definer), which checks the caller is an adult and every participant is in the household, and inserts the goal
  and its participants together; `goal_participants` has no insert grant. Adults delete any open goal.
- **Adults edit open goals** with `update_goal(goal_id, title, target_points, owner_id, participants)` (security
  definer): the reward, the points and who it is for, shared ↔ personal included, replacing a shared goal's
  participants. It checks participants like `add_shared_goal()` (both use `private.check_goal_participants()`) and
  locks the row, so a goal isn't claimed mid-change. `created_at` stays, so points earned since the goal was set
  still count: lowering the target can make it reached at once. Claimed goals can't be edited.
- **Minimum per participant**: each participant can have their own `min_points` (≥ 1; `add_shared_goal()` checks
  they add up to at most `target_points`), so one member can't reach it alone and a younger child can be asked for
  less. A goal is reached only when the total reaches the target _and_ every participant has earned their minimum
  (`private.goal_participant_points()`, `private.goal_is_reached()`). Someone who joins later isn't added to
  existing goals. A member leaves only by deleting their account: they stop taking part and, since their tasks no
  longer say who did them, their points stop counting (adults can delete a goal nobody can reach any more). When
  this replaced the single `min_points_per_member`, existing shared goals got every then-current member as a
  participant with that minimum each, even where those add up to more than the target.
- **Progress is counted, not stored**: `private.goal_points(goal)` sums the points of shared tasks done from the
  goal's `created_at` until it was claimed, credited to its participants (its owner for a personal goal), helpers'
  shares included (`private.task_credits`, ADR 0004). `household_goals()` (security
  invoker) returns the household's goals with their points, `reached`, `owner_name` and, for shared goals,
  `participants` (points and minimum each), open ones first (newest first), then claimed ones. The app shows `reached` rather than deciding
  itself, so the Claim button and `claim_goal_reward()` always agree. A shared goal's card shows each participant's
  points in full against their minimum (`37 / 50`, also past it), with a bar on the goal's scale marking the minimum.
- **One open goal at a time** (#74): each member takes part in at most one open shared goal and has at most one
  open personal goal, so one stretch of work doesn't pay for several rewards. The next goal can be set once the
  current one is claimed or deleted. `add_shared_goal()` and `update_goal()` check participants
  (`private.check_one_open_shared_goal()`), and a trigger on `goals` checks a personal goal's new owner
  (`private.check_one_open_personal_goal()`); both raise `unique_violation` (23505) and take a per-household
  advisory lock, so two adults can't both set one at once. Someone already in the goal being changed isn't checked
  again, so goals that were open together before this rule can still be edited. The form shows members who
  already have an open goal of that kind as unavailable, with the reason (`membersWithOpenGoal()`).
- **Points aren't spent or reset**: a goal counts from zero, from when it was set, and points beyond its target
  don't roll over. Nothing is subtracted, so there is no balance to argue about. Points earned over time stay in the
  Statistics totals (ADR 0006), which goals never reset.
- **Claiming**: `claim_goal_reward(goal_id)` (security definer) claims an open shared goal the user takes part in
  or their own personal goal, once `goal_is_reached()`, and only once (row lock). Claimed goals stay as
  history ("Rewards claimed") and can't be deleted. Undoing a task after a claim doesn't unclaim it.
- **Celebrating a claim**: once claiming succeeds, confetti falls over the screen around a "Reward claimed!" badge
  for three seconds (`RewardCelebration`, found from the claim's mutation state so it outlives the goal card). Like
  the done-task celebration (ADR 0004) it is plain CSS, no dependency, decorative (`aria-hidden`, no pointer
  events) with a screen-reader status instead; with reduced motion only the badge shows, without moving.
- The Rewards screen refetches goals when it opens (TanStack Query default), so tasks done elsewhere show up; no
  live updates for goals.

## Consequences

- A child can't suggest or change a goal; they ask an adult. Changing a goal keeps no history of what it was.
- A family wanting two rewards at once makes them one goal, or claims one before setting the next.

## Alternatives considered

- A points balance that rewards spend (needs a ledger and a reset policy, and invites competition); storing
  progress on the goal (drifts when tasks are undone or edited).
- Several open goals sharing the same points (rewards stack, which feels too easy); choosing a goal for each
  task's points (a step every time a task is done); rolling extra points over to the next goal (more bookkeeping,
  and the totals already live in Statistics).
