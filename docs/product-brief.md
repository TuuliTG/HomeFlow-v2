# HomeFlow — product brief

Condensed from the HCI project report (user research + two prototype iterations). Read this before building features.

## Problem

Household work, especially **cognitive labour** (planning, remembering, booking, adding tasks), is invisible and
unevenly shared, which causes unfairness and conflict. Existing chore apps only list chores and add managerial burden.

## Requirements

1. **Visibility & fairness** — shared overview of what exists, who did it, and who planned it.
2. **Cognitive + physical tasks** — creating/organising tasks is work and is credited: doing a task earns its
   points, and the tasks each member creates are counted (creating earns no points).
3. **Low effort, non-intrusive** — quick interactions; must not become another chore for the organiser.
4. **Positive motivation** — points, progress, shared family goals; no punishment.
5. **Child-friendly mode** — minimal text, icons, colours, stars/progress (later iteration).
6. **Transparency over time** — simple history/fairness trend, not data-heavy.

## Screens (mid-fi prototype, mobile, bottom tab bar: Me · Tasks · Rewards · Statistics)

- **Available tasks** — "Fairness this week" stacked bar per member; filter; task cards with points, tags
  (frequency, type physical/meta), bonus points (e.g. "new for you", fairness boost), "last done by …";
  **Pick up task** button; **+** to create a task.
- **Create / edit task** — reuse a previous task or type a new one; points, type, assignees (adults default, children
  opt-in); a **private** check mark keeps a task to yourself, without points. Creating a task gets positive
  feedback and counts towards _tasks created_ (no points).
- **My tasks (Me)** — _To do_ (picked up, due date, points) and _Completed_ (with streak); meta tasks highlighted in purple.
- **Rewards** — points per member, personal rewards/collectibles, shared family goal progress. Must make clear how
  points are earned and how shared goals accumulate.
- **Statistics** — period selector; _points earned_ (from doing tasks) and _tasks created_ per member, each with its
  own fairness score (0–100, e.g. "Balanced"); contribution over time. Only shared tasks count; private tasks never do.

## Design principles from evaluation

- Self-assignment, never one person assigning to others.
- Clearly separate **tasks done** from **tasks created** everywhere points appear.
- Encourage rotation: bonus for unfamiliar tasks, diminishing points for repeating the same task.
- Avoid pure competition; open questions: reward reset period, lightweight thumbs-up/comments.
