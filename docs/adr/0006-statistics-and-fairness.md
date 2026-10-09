# 0006. Statistics and fairness

- **Updated:** 2026-10-09

## Context

The Statistics screen shows the family how household work is shared over a period, crediting both doing tasks
(physical work) and adding them (meta work), without turning it into a contest. It must stay correct as the task
history grows past what one API request returns.

## Decisions

- **Counted in the database**: `household_statistics(since)` (security invoker, so Row Level Security scopes it to
  the caller's household) returns, per member and in the order they joined, their display name, the shared tasks
  they _did_ (`completed_at >= since`) and the points those earned, and the shared tasks they _created_
  (`created_at >= since`), all in their current household; `since` null means all time. Totals aren't cut short by
  the 1000-row API limit. Private tasks never count; people who left the household aren't listed.
- **Periods** are local calendar periods up to now: _This week_ (from Monday), _This month_ (from the 1st) and _All
  time_, computed in the browser (`periodStart()` in `src/features/statistics/statistics.ts`) and kept in the address
  as `?period=`.
- **Two separate metrics, never combined**: _Points earned_ (physical work, from doing tasks) and _Tasks created_
  (meta work). Each has its own ranking and fairness score, so points and task counts are never added together.
- **Fairness score** (0–100) per metric: each member's share compared with an equal share. The score is
  `100 × (1 − d / dmax)`, where `d` is half the sum of `|share − 1/n|` and `dmax = 1 − 1/n` (one member has it all),
  so 100 is perfectly even and 0 is one member having it all. ≥ 80 is _Balanced_, ≥ 50 _Slightly uneven_, below that
  _Uneven_. No score with one member or when no one has any yet (`fairnessOf()`).

## Consequences

- Each ranking and its score use the same numbers, so what the family sees explains the score.
- A new metric (e.g. points for creating tasks, once they exist) is another `Metric` and column of
  `household_statistics()`.

## Alternatives considered

- Fetching task rows and counting in the browser (breaks silently past the row limit); one combined score of done
  and created tasks (mixes physical and meta work into a number that explains neither).
