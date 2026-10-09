# 0006. Statistics and fairness

- **Updated:** 2026-10-09

## Context

The Statistics screen shows the family how household work is shared over a period, crediting both doing tasks
(physical work) and adding them (meta work), without turning it into a contest. It must stay correct as the task
history grows past what one API request returns.

## Decisions

- **Counted in the database**: `household_statistics(since)` (security invoker, so Row Level Security scopes it to
  the caller's household) returns each member's shared tasks _done_ (`completed_at >= since`) and _added_
  (`created_at >= since`), in the order they joined; `since` null means all time. Totals aren't cut short by the
  1000-row API limit. Private tasks never count; people who left the household aren't listed.
- **Periods** are local calendar periods up to now: _This week_ (from Monday), _This month_ (from the 1st) and _All
  time_, computed in the browser (`periodStart()` in `src/features/statistics/statistics.ts`) and kept in the address
  as `?period=`.
- **Fairness score** (0–100): each member's share of all done + added tasks, compared with an equal share. The score
  is `100 × (1 − d / dmax)`, where `d` is half the sum of `|share − 1/n|` and `dmax = 1 − 1/n` (one member did
  everything), so 100 is perfectly even and 0 is one member doing it all. ≥ 80 is _Balanced_, ≥ 50 _Slightly
  uneven_, below that _Uneven_. No score with one member or nothing done or added. Doing and adding a task count the
  same, one each; points don't weigh in yet.

## Consequences

- The leaderboard and score use the same counts, so what the family sees explains the score.
- Changing what counts (e.g. weighting by points, children opting out) changes `fairnessOf()` and possibly
  `household_statistics()`.

## Alternatives considered

- Fetching task rows and counting in the browser (breaks silently past the row limit); weighting by points (points
  for adding tasks don't exist yet).
