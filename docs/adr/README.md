# Architecture Decision Records

The decisions that shape HomeFlow and why, grouped by topic. Read the ones your change touches before starting.

| ADR                                     | Topic                                                             |
| --------------------------------------- | ----------------------------------------------------------------- |
| [0001](0001-how-we-work.md)             | Decision records, branches, PRs, CI and tests                     |
| [0002](0002-stack-and-architecture.md)  | Tech stack, Supabase, folder structure, PWA, hosting              |
| [0003](0003-accounts-and-households.md) | Login, personal data, households, invite codes, RLS scoping       |
| [0004](0004-tasks.md)                   | Task data, marking done, repeating tasks, reminders, live updates |
| [0005](0005-push-notifications.md)      | Web Push, device subscriptions, the Edge Functions that send      |
| [0006](0006-statistics-and-fairness.md) | Statistics periods, household_statistics(), the fairness score    |
| [0007](0007-goals-and-rewards.md)       | Family and personal goals, their progress and claiming rewards    |
| [0008](0008-news-and-praise.md)         | The News tab, thumbs up and comments on done tasks                |

## Guidelines

- **One ADR per topic, few topics.** A new or changed decision updates the ADR for its topic in the same PR:
  add or edit a bullet and bump the `Updated` date. Git history keeps earlier versions; don't keep superseded
  text around.
- **A new ADR only for a new area** that fits none of the above (e.g. rewards). If a topic grows past
  ~40 lines, summarise it or split it in two; if two get small, merge them. Aim for no more than about eight.
- **Short and concrete**: Context (2–3 sentences), Decisions (bullets someone can follow without reading the PR),
  Consequences, and Alternatives in one or two lines if worth it. Name tables, functions and files.
- **Record decisions, not features.** A routine feature that follows existing decisions needs no ADR change.
- Numbers are just stable names; code comments may cite them (`ADR 0004`). Migrations written before
  2026-10-08 cite the old one-decision-per-file numbers (0009–0015), which are in git history.
