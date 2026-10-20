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
5. **Child-friendly mode** — minimal text, icons, colours, stars/progress. Children have only two tabs, Me (their
   tasks and the progress of their personal and shared goals, claimed there) and Shared tasks, without filters; no
   News, Rewards or Statistics.
6. **Transparency over time** — simple history/fairness trend, not data-heavy.

## Screens (mid-fi prototype, mobile, bottom tab bar: Me · Tasks · News · Rewards · Statistics)

- **Shared tasks** (formerly Available tasks) — filter; task cards with points, tags
  (frequency, type physical/meta), bonus points (e.g. "new for you", fairness boost; later iteration), "last done by …";
  **Pick up task** button; **Ask** someone else to do a task (they're notified and accept or decline); **+** to
  create a task.
- **Create / edit task** — reuse a previous task or type a new one; points, type, assignees (adults default, children
  opt-in); up to three pictures to clarify details; an optional icon (e.g. a bed) shown on the task's tile; a **private** check mark keeps a task to yourself, without points. Creating a task gets positive
  feedback and counts towards _tasks created_ (no points).
- **My tasks (Me)** — _To do_ (picked up, due date, points) and _Completed_ (with streak); meta tasks highlighted in purple.
  On a done task, _Who helped?_ (also asked right after marking it done) gives helpers (a child who helped, an adult
  who shared it) part of its points; helpers see the tasks they helped with under _Completed_. _To do_ can also show
  as a private timetable of a day or a week, to plan when to do each task by dragging it to a time.
- **News** — what the family has done in the last week, by day: each member's points that day (physical and meta
  work apart) and each shared task done. Members give a thumbs up to others' work and comment on it.
- **Rewards** — shared goals (for the whole family or the members an adult picks, e.g. two siblings; their points
  count) and personal goals (only yours count; the family sees them to cheer each other on), each a reward with the
  points needed and its progress; a shared goal can ask each participant for their own minimum, e.g. less for a
  younger child, so nobody does it all alone; claim the reward once reached. Each member has one open shared goal and
  one open personal goal at a time, each counting from zero; points earned over time stay in Statistics. Must make
  clear how points are earned and how shared goals accumulate.
- **Statistics** — period selector; who to compare (everyone, adults, children or chosen members); _points earned_
  (from doing tasks, all or physical/meta work apart) and _tasks created_ per member, each with its own fairness score
  (0–100, e.g. "Balanced"); contribution over time. Only shared tasks count; private tasks never do.

## Design principles from evaluation

- Self-assignment, never one person assigning to others: a member can ask another to do a task, but it is theirs
  only once they accept.
- Clearly separate **tasks done** from **tasks created** everywhere points appear.
- Encourage rotation: bonus for unfamiliar tasks, diminishing points for repeating the same task (later iteration).
- Avoid pure competition; praise each other with a thumbs up or a comment (News). Open question: reward reset period.
