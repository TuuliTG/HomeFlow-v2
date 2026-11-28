# 0008. News and praise

- **Updated:** 2026-11-27 (emoji reactions instead of only a thumbs up)

## Context

Seeing what others in the family have done, and thanking them for it, is positive motivation without competition
(product brief: "lightweight thumbs-up/comments"). It must stay low effort and never reveal private tasks.

## Decisions

- A **News** tab (`/news`, `src/features/news`) lists the household's shared tasks done in the last seven local days
  (`newsStart()`), newest first, grouped by the day they were done (Today, Yesterday, "Thu 8 Oct"). Each day starts
  with each member's points that day, physical and meta work apart ("Ben earned 10 points: 7 physical, 3 meta work"),
  helpers' shares counted as theirs rather than the doer's (ADR 0004), added up in the browser from the same rows
  (`groupByDay()`); a family does far fewer than the 1000-row API limit
  in a week.
- **Reactions**: `task_likes` (one per member and task, primary key `(task_id, user_id)`) with an `emoji`, one of
  👍 ❤️ 👏 🎉 💪 😂 (a check constraint, `reactions` in `news.ts`; 👍 by default). A member reacts to a done shared task
  someone else did, never their own work, and changes (only `emoji` can be updated, while they still could react)
  or takes back only their own. An emoji the app doesn't know yet shows as 👍, so adding one doesn't break older apps.
  The client inserts and, if they had reacted already, updates the emoji. The card's React button opens the emoji in
  a row; reactions show grouped by emoji (`groupReactions()`): "❤️ You and Ben".
- **Comments**: `task_comments` (trimmed, 1–500 characters) on a done shared task, also one's own (to reply). Only
  the author can delete one; nobody can edit one. A comment stays without a name when its author's account is deleted.
- **RLS leans on the tasks' own policy**: both tables are visible when the task is (`exists` on `tasks`), so only the
  household sees them and never on another member's private task. Inserting checks the task is done and shared;
  the client can only send `task_id` (and `emoji` or `body`), the database fills in who.
- Read in one request: `tasks` with embedded `task_likes` and `task_comments`, then the names from `profiles`.
- No Realtime for news: TanStack Query refetches when the tab opens or regains focus and every minute while open.
  A reaction shows straight away and goes back if saving fails.

## Consequences

- Undoing a task done (ADR 0004) keeps its reactions and comments; they show again if it is marked done again.
- A new reaction (with its emoji) or comment notifies whoever did the task, its helpers and earlier commenters
  (`notify-praise`, ADR 0005).
- Changing one's emoji doesn't notify again.
- Reactions and comments on tasks older than a week stay stored but aren't shown.

## Alternatives considered

- Only a thumbs up (the first version; too little to say thanks with); any emoji (a picker and
  validation for little gain); several reactions per member (more to tap and read); a stored feed or event table
  (duplicates what `tasks` already records).
