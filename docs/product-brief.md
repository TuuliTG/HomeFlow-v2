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

- **Shared tasks** (formerly Available tasks) — search and filter, also by who has picked tasks up; task cards with points, tags
  (frequency, type physical/meta), bonus points (e.g. "new for you", fairness boost; later iteration), "last done by …";
  **Pick up task** button; **Ask** someone else to do a task (they're notified and accept or decline); **+** to
  create a task.
- **Create / edit task** — first choose who it is for: adults (the default) or children. A task for children is the
  children's only, kept on that child's page for adults to check and edit; an adult picks the child, whose own short form (the same as on the child's page from the family page) sets the stars it earns, a description and pictures, and it goes straight onto their Me page. A child's everyday chore can be **always there**: no due date or repeat, back on their Me page a moment after it is done, earning stars up to a daily limit (once a day unless the adult chooses more, or no limit). A child's page also copies their tasks to a brother or sister. Then reuse a
  previous task, start from a ready-made one (everyday chores, simpler ones for children), or type a new one; points (starting from the adult's default, chosen in the settings), type; up to three pictures to clarify details; an optional icon (e.g. a bed) shown on the task's tile; a **private** check mark keeps a task to yourself, without points. A shared task can also have 0 points, e.g. a reminder: it counts for nobody in statistics or News. An **Already done** check mark adds a task you have just done and marks it done at once. Creating a task gets positive
  feedback and counts towards _tasks created_ (no points).
- **My tasks (Me)** — _To do_ (picked up, due date, points) and _Completed_ (with streak); meta tasks highlighted in purple.
  On a done task, an adult's _Who helped?_ (also asked right after marking it done) gives helpers (a child who helped,
  an adult who shared it) bonus points on top of the task's; helpers see the tasks they helped with under _Completed_. _To do_ can also show
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
  (0–100, e.g. "Balanced"); contribution over time. Only shared tasks with points count; private tasks never do.

## Design principles from evaluation

- Self-assignment, never one person assigning to others: a member can ask another to do a task, but it is theirs
  only once they accept. The one exception: an adult can give a child a chore of their own.
- Clearly separate **tasks done** from **tasks created** everywhere points appear.
- Encourage rotation: bonus for unfamiliar tasks, diminishing points for repeating the same task (later iteration).
- Avoid pure competition; praise each other with a thumbs up or a comment (News). Open question: reward reset period.
