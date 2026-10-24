# 0004. Tasks

- **Updated:** 2026-10-24 (chores given to one child, filtering the board by who picked tasks up)

## Context

A household shares one task board. Adding a task is meta work (planning) and doing it is physical work; both are
credited later, so the data must record who did what and when. Many tasks repeat, and a late task should push the
next one back rather than follow a fixed calendar.

## Decisions

- `tasks` belong to a household: title, optional description (≤ 500 characters), type (`physical`/`meta`),
  points (1–10), `created_by` (from the default, never the client), optional `due_on`, `repeat_every_days`
  (1–365), `completed_at`/`completed_by` and `previous_task_id`. New tasks default to the creator's household.
- **Private tasks**: `is_private` (chosen when adding, never changed; the next occurrence keeps it). The select
  policy shows a private task only to its creator, so the board, "Show completed" and live updates hide it from
  the others, and every security definer function that acts on any open task skips other members' private ones.
  A private task is the creator's own to do: it is listed only in their My tasks (Me page), without picking it up,
  and has no Pick up or Put back. The Shared tasks board and its "Show completed" leave out even the creator's
  own private tasks, and saving or deleting one returns to the Me page (Cancel on the task form goes back to the
  previous page). **Private tasks have no points** (`tasks_private_without_points`) and statistics count only
  shared tasks, both done and created (ADR 0006). A private task whose creator deletes their account or leaves
  stays hidden from everyone.
- **Tasks for children**: `for_children` (default false: adults only), chosen on the task form by adults ("Children
  can do it", not offered for their private tasks) and changeable when editing; the next occurrence keeps it. A
  child (ADR 0003) sees and acts only on tasks for children, and every task they add is one (insert policy;
  `update_task()` refuses a child making one adults-only). `private.can_see_task()` holds the visibility rule
  (household, private, children) for every security definer function acting on a task, reminders and undo
  included; the select policy spells the same rule out inline, since a function with `SET` isn't inlined and would
  stop the household index being used. A child never holds an adults-only task: making one adults-only, or marking
  its picker as a child, puts it back and removes their reminder (`private.put_back_adults_tasks()`), and
  `take_due_reminders()` never sends a child one; a new child's private tasks become theirs for children.
  Statistics and goals count every shared task for everyone (`household_statistics()`, `private.goal_points()` and
  `private.goal_member_points()` are security definer and return no task titles); a child's News lists only tasks
  for children.
- **Children adding tasks**: adults always add tasks; a child only when an adult allows it
  (`household_members.can_add_tasks`, `set_member_can_add_tasks()`, ADR 0003), shared or private. **A child's shared
  task has no points** until an adult awards them (`award_task_points()`, adults only, once), so a child can't pick
  their own reward: they add it, do it, and an adult decides what it was worth from the **Waiting for points** list
  on the Shared tasks page. The insert policy refuses points from a child (and a shared task without points from an
  adult); a child's edit never sets them; the next occurrence of a child's repeating task waits for points again.
  Until then it earns nothing in totals, statistics, goals or News. Children edit and delete only tasks they added
  (`private.can_change_task()`).
- **Least privilege**: members can read and insert tasks; every change goes through a function. Marking done uses
  `complete_task(task_id, completed_on)` (security definer). In one transaction it marks an open task in the
  caller's household done and, if it repeats, inserts the **next occurrence**, due
  `completed_on + repeat_every_days`, keeping the original creator. `previous_task_id` is unique: one next
  occurrence per task.
- `completed_on` is the user's local date; the database accepts only the server's date ± 1 day.
- **Picking up**: `pick_up_task()` / `put_back_task()` (security definer) set `picked_up_by` / `picked_up_at` on an
  open task. A task someone has picked up can't be taken by another member (55006); only they can put it back. Anyone
  can still mark any task done (credited to whoever does), so a task left picked up never blocks the family, but
  the app asks first ("Ben has picked this up. Mark it done anyway?").
- **Asking someone**: a member can ask another to do an open shared task that is free or that they picked up
  (handing it over). `task_requests` (one per task; asking again replaces it) is written only through
  `request_task()`, `answer_task_request()` and `cancel_task_request()` and is visible with its task; only members
  who may do the task can be asked (a child only a task for children). The member asked is notified (ADR 0005) and
  accepts, which picks the task up for them, or declines; nobody gets a task without saying yes, keeping the
  product's "self-assignment" principle (the one exception is a chore an adult gives a child, below). The card shows the request: Accept/Decline to the member asked (also under
  _Asked of you_ on the Me page), Cancel to whoever asked, and a decline only to whoever asked until dismissed. A
  trigger (`private.settle_task_requests()`) removes a request once the task is done or someone other than the
  member asked picks it up, and an accepted one once they give it back; the member asked picking the task up
  accepts it. Answering and cancelling lock the task before the request, like picking up, so they can't deadlock. Each function touches the task row, so live updates carry requests too.
- **Chores for one child**: an adult can give a task for children to one child in the household ("Whose chore is
  it?" on the task form, shown once "Children can do it" is checked and the household has children; `assigned_to`,
  only for a shared task for children, `tasks_assigned_only_for_children`). Parents asked for this: some chores
  are one child's job, so asking and waiting for a yes doesn't fit. A trigger (`private.pick_up_for_assignee()`)
  picks it up for the child, also from whoever had it, so it is on their Me page with no new list, and puts it
  back for any child when an adult clears it; the triggers on picking up then settle requests and schedules. It is
  the child's alone: they can't put it back (`put_back_task()`), nobody can be asked to do it (`request_task()`),
  and other children don't see it (`private.can_see_task()` and the select policy) nor are told it was added
  (`notify-household`), so neither can they act on it. Adults see it on the board as "Only for Ben", can still mark it done like any task, and change or clear the
  child by editing it (`update_task(task_assigned_to)`; a child's edit keeps it). Only adults give tasks, and only
  to a child in their household (`private.is_child_in_household()`, insert policy). The next occurrence goes to the
  same child while they are still one; a child who becomes an adult keeps their chores picked up, no longer given
  to them (a trigger on `household_members`). Adding a task again from earlier tasks doesn't copy the child.
- **Fixing mistakes**: any adult, and a child for their own tasks, can edit (`update_task()`) or delete
  (`delete_task()`) an open task; done tasks
  stay as history. Whoever marked a task done can undo it for an hour (`undo_complete_task()`), which also removes
  the next occurrence it created, unless that one is already done.
- **Pictures**: whoever may edit a task (`private.can_change_task()`) can attach up to three pictures on the task
  form, e.g. to show which plants to water; its card shows them as thumbnails that open full size. The app redraws
  each as a JPEG of at most 1600 px (`shrinkImage`), which also drops metadata such as the photo's location, and
  uploads it to the private Supabase Storage bucket `task-images` (≤ 5 MB, JPEG/PNG/WebP) as
  `<household id>/<random>.jpg` (adults and children who may add tasks), then attaches the files in order with
  `set_task_images()` (security definer; only files the user uploaded can be added; it touches the task row so
  live updates show the change). `task_images` (task, file, position) is readable by whoever can see the task;
  storage policies show a member a file they uploaded or one on a task they can see, so a private or adults-only
  task's pictures, and uploads not yet attached, stay hidden like the task. The app shows them through signed URLs
  valid for an hour. A repeating task's next occurrence shows the same files, and done tasks keep theirs as
  history, so a file is deleted (by the app, through the Storage API, which refuses direct SQL deletes) only when
  no task shows it any more (`private.is_task_image_in_use()`), by whoever uploaded it or took it off a task
  (`private.task_image_removals`, noted by a trigger): after removing a picture or deleting a task. Uploads come
  first and are deleted again if saving fails; if a new task's pictures can't be attached, its edit page opens to
  add them again. Editing compares against the pictures the form opened with, so it keeps ones others added.
- **Icons**: whoever may edit a task can give it an icon, chosen behind a "Choose an icon" button from a fixed set of
  emojis (`taskIconNames`, drawn as the device's emoji by `TaskIcon`, no dependency), so children who can't read
  yet see what it is about. The tile on its card shows it in the type's colours instead of the type's icon.
  `tasks.icon` is a name (`bed`, `dog`, …), checked only for its format, so the set can grow without a
  migration; the app reads a name it doesn't know as no icon. Insert, `update_task()` (`task_icon`), the next
  occurrence (`complete_task()`) and `task_suggestions()` carry it. Line icons were tried first and were too hard
  to tell apart.
- **Screens for children** (`useIsChild()`; until known, a loading message, and if it can't be told, the adults'
  screens, which show a child only what they may see): the Me page (`src/app/MePage`) shows their open goals as
  star jars (ADR 0007), their own tasks as big tiles (`ChildTaskTiles`: icon, name, one star per point, a round
  Mark done button, Edit on ones they added), and their Completed list. Like adults, they pick tasks on Shared
  tasks (`ChildBoard`), which shows the tasks for children, the only ones they see, as tiles: free to pick (Pick
  up), picked by them and who is doing the rest, without the filters, then Show
  completed. These are a child's only tabs (`MainNav`, showing the others once the user is known to be an adult):
  News, Rewards and Statistics, and the goal forms, send a child to their Me page (`src/app/AdultsOnly`), where
  their jars show their goals' progress. Children's screens carry no hints or explanations. Adults' screens are unchanged. Points are still called points, as
  elsewhere.
- **Points**: the Me screen shows the user's total points, summed when read (`own_total_points()`), not stored.
  Adding tasks earns nothing yet. Points also count towards goals (ADR 0007).
- **Helping**: whoever marked a shared task with points done can say, for a week (as long as it is in the News), who
  helped them and give each helper a share of its points (`task_helpers`, written only by `set_task_helpers()`, which
  replaces the helpers). Right after marking such a task done, a prompt ("Laundry done! Did someone help?") links to
  the form for a while, unless nobody else is in the household (`WhoHelpedPrompt`, found from TanStack Query's
  mutation state, since the card goes when the board refreshes); "Who helped?" on the Me page's Completed list offers
  it for the rest of the week. We ask after the tap rather than adding a "Do together" button to every card: a phone's
  action row is already full, and who helped is only known once the work is done. Shares are 1–10 and together at most the
  task's points, and come out of the doer's points, so a task is worth the same however many helped: adding helpers
  can't inflate totals or skew fairness. Only the doer chooses, since they give away their own points; a helper is
  any other member, also a child helping with an adults-only task (they get the points without seeing the task). The
  form suggests an even split. `private.task_credits` (a view only security definer functions read) credits the doer
  the rest and each helper their share; statistics, goals and `own_total_points()` count it, and News adds up the
  same from the embedded helpers. Undoing a task removes its helpers; a repeat doesn't copy them. A helper's Me page
  lists the tasks they helped with among those they did ("You helped Anna", with their share), read with
  `own_helped_tasks()` (security definer): a child sees there the title of an adults-only task they helped with, and
  only there. The task stays off their board and News, and other children's, to keep a child's view simple.
- The board (the **Shared tasks** page) shows open shared tasks, soonest due first and tasks without a due date last (newest first within a date).
  It and the Me page's _To do_ group them under headings like an agenda (`groupByDueDate`): Overdue, Today, Tomorrow,
  each of the next five days by date, Later and No due date, leaving out empty groups. Grouping is done in the app
  from the same sorted list, with the user's local date; the board has no calendar grid, which needs far more room
  on a phone (the Me page offers one as an optional view, below).
  "Show completed" (`?completed=1`, so it survives a reload) adds the household's 30 most recently done shared tasks.
  A **Show** filter (`?show=`, one choice at a time, `taskFilter.ts`) narrows the board to tasks due **Today** or
  **This week** (the next seven days, so it ends where "Later" begins; both include overdue tasks, which still need
  doing), with **No due date**, or **Available** (nobody has picked them up); **All** is the default. A
  **Picked up by** row (`?who=<user id>`, `pickerFilter.ts`; not shown to someone alone in their household) narrows
  it further to the tasks one member has picked up: **Everyone** (the default), **You**, then the others in the
  order they joined; a member not in the household (any more) shows everyone's. It leaves "Show completed" as it
  is, like the search. These choices
  ("Show completed" on a child's board too), like the Me page's view (`?view=`), are remembered on the device (ADR
  0002), so the nav link brings them back.
  A **search** above the filter (`?q=`, `searchTasks()`) narrows the board further to tasks whose title or
  description contains every word typed, ignoring case but keeping ä apart from a (different letters in Finnish and Swedish), so
  a family member can check whether a task already exists before adding it. It is done in the app on the tasks
  already loaded, and isn't remembered on the device: a forgotten search would hide tasks unnoticed. It leaves the
  completed tasks below as they are: they answer "what was done lately", not "does this task exist". A hidden
  status region reads out how many tasks match while typing.
- **Who last did it**: the card of a repeating shared task says who marked its previous occurrence done and how
  long ago in the user's calendar days ("Last done by Ben, 3 days ago"), so the family sees who usually carries it
  and can take turns. It comes from `previous_task_id`, embedded as `previous_occurrence(...)`: PostgREST finds no
  relationship for a self-referencing one-to-one key, so `public.previous_occurrence(tasks)` (security invoker, so
  RLS applies) is a computed relationship. We chose the last doer over "usually done by", which needs a period and
  a tie-break and reads less clearly on a small card. Private tasks don't show it, as statistics leave them out.
- **Celebrating**: once marking a task done succeeds, stars burst and the points earned (or a tick) pop up for
  about a second (`TaskCelebration`, found from the same mutation state as `WhoHelpedPrompt`), for every task the
  user marks done. It is plain CSS and SVG, no dependency. It is decorative (`aria-hidden`, no pointer events, fixed
  so the layout doesn't move); screen readers hear "<task> done!" unless the who-helped prompt says so already. With
  reduced motion there are no stars and the badge doesn't move. The badge shrinks away instead of fading so its text
  keeps its contrast.
- **Adding a task again**: the New task form suggests earlier tasks from the household's own history, read with
  `task_suggestions()` (security invoker, so RLS hides other members' private tasks): one per title ignoring case,
  with the newest occurrence's details, most often added first (repeats a task adds itself don't count). Typing a
  name lists the matching ones; picking one fills in the form without a due date. There is no templates table:
  deleted tasks drop out on their own, and categories can later filter the same list.
- **Tasks from other apps**: a link to `/tasks/new?title=…&description=…&due=YYYY-MM-DD` fills in the New task
  form (`taskFromLink()`), so another app, such as the owner's email assistant, can hand over a task it found
  without any access to HomeFlow. The link only fills in the form: the user chooses the type, points and who it's
  for and saves it as usual, so the normal checks, RLS and push apply. A name or description too long to save is
  shortened and a due date that isn't a date is left out. A link opened while logged out is lost at the login.
- **Favourites**: before a name is typed, the form offers the household's favourite tasks by name instead of the
  most often added ones, which changed under the user and weren't what they wanted. A star by the name field stars
  or unstars the task being named, also a new one, saved straight away; so does a star on each open task card and
  on each done task in the board's and the Me page's Completed lists. Favourites are shared by the household:
  any member's star shows for everyone, and any member can remove it. `favourite_tasks` stores only the name
  ignoring case (`title_key`), one row per member who starred it, so a star never reveals a private task: a member
  sees a star they set or one on a task they can see (`private.can_see_favourite()`, which leans on the tasks'
  RLS). The details come from `task_suggestions()`, which returns the 50 most often added tasks plus every
  favourite, so a favourite whose task is deleted isn't offered.
- **Reminders**: a member can ask to be reminded of a task that is theirs to do (their private task or one they
  picked up) at a time they choose, within a year. `task_reminders` (one per task and user) is visible only to its
  owner and written only through `set_task_reminder()` / `clear_task_reminder()`, which check the task is theirs;
  putting a task back removes it. The `send-reminders` Edge Function (ADR 0005) sends due reminders as a push
  notification to the owner's devices, opening My tasks. It takes them with `take_due_reminders()` (service role
  only), which deletes every due reminder and returns those whose task is still theirs and open and that are less
  than an hour late, so a reminder is sent at most once, and not for a task done meanwhile or after an outage. The
  app hides reminders whose time has passed. Reminders aren't copied to a repeating task's next occurrence.
- **Scheduling**: the Me page's _To do_ shows as a **List** (the agenda above), or a timetable of a **Day** or a
  **Week** from Monday (`?view=`), where a member plans when to do each task that is theirs to do, as a block with a
  start and a length. `task_schedules` (one per task and user, `starts_at` timestamptz, `duration_minutes` 5–720)
  is like reminders: only its owner sees it, and it is written only through `set_task_schedule()` /
  `clear_task_schedule()`, which check the task is theirs to do; a trigger removes the schedule of whoever gives a
  task back, however it changes hands. It is a plan, separate from the due date, so it moves no deadline. Tasks are
  placed by dragging (`@dnd-kit/core`: mouse, or touch and hold so a swipe still scrolls) in 15-minute steps,
  with a preview of where they land; the day and time come from the pointer over the columns, measured as it moves,
  so they stay right while the timetable scrolls. Tasks not scheduled yet are chips above the timetable, so they
  show without scrolling; a chip opens a form (day, start, length), the way to schedule with a keyboard or screen
  reader, and a block opens the task's card, as on the list, with when it is planned and **Change time** for that
  form; a live region says where a dragged task went. The empty part of each day is one button: a tap
  opens what to do at the quarter tapped (a key press, at a suggested time), one of the tasks not scheduled yet
  or **Add a new task**, whose form (`paths.newTaskAt`, `?at=`) puts the new task there once added, picking a
  shared one up first, as only tasks that are the user's to do can be scheduled. The timetable shows even
  without tasks to do, to add one from it. The
  hours scroll inside a focusable region, which axe requires, so ESLint allows `tabIndex` on `role="region"`.
  Done tasks leave the timetable, and a schedule isn't copied to a repeating task's next occurrence.
- **Live updates**: `tasks` is in the `supabase_realtime` publication (RLS applies per subscriber). The app
  subscribes once (`subscribeToTaskChanges`) and refetches through TanStack Query on every insert, update or
  delete (deletes aren't filtered by RLS, so they only trigger the refetch). Tasks
  others add show a short message ("Ben added Book dentist"); the next occurrence of a repeating task doesn't.

## Consequences

- Each occurrence is its own row, so history, streaks and statistics come from completed rows.
- Intervals are whole days ("the 1st of every month" isn't possible).
- Picture files can be left behind (a failed delete, a next occurrence removed by undoing a task); they count
  against the free storage tier until cleaned up, and pictures of done tasks are kept until their task is deleted.

## Alternatives considered

- Scheduling: a column on `tasks` (others would see your plans), native HTML drag and drop (doesn't work with
  touch), a timetable on the board (too little room on a phone).
- A calendar recurrence rule (doesn't move with late tasks), reopening the same row (loses who did each
  occurrence), creating the next occurrence from the app (two requests that can half-fail or race).
