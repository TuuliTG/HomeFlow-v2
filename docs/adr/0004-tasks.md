# 0004. Tasks

- **Updated:** 2026-11-23 (every task for children is one child's; the board lists adults' tasks only)

## Context

A household shares one task board. Adding a task is meta work (planning) and doing it is physical work; both are
credited later, so the data must record who did what and when. Many tasks repeat, and a late task should push the
next one back rather than follow a fixed calendar.

## Decisions

- `tasks` belong to a household: title, optional description (≤ 500 characters), type (`physical`/`meta`),
  points (0–10; 0 counts for nobody), `created_by` (from the default, never the client), optional `due_on`, `repeat_every_days`
  (1–365), `completed_at`/`completed_by` and `previous_task_id`. New tasks default to the creator's household.
- **Repeat intervals**: the form offers ready-made intervals (`repeatChoices`) and "Custom…", every so many
  days or weeks (`taskRepeat.ts`); the database stores days only, so a custom interval of whole weeks shows in
  weeks when edited.
- **Links in descriptions**: the card turns `http(s)://` and `www.` addresses in a description into links that
  open in a new tab (`descriptionParts()` in `descriptionLinks.ts`) and wraps long ones so they fit and can be
  copied. Other schemes (`javascript:`, `mailto:`) stay plain text; the description is never rendered as HTML.
- **Private tasks**: `is_private` (chosen when adding, never changed; the next occurrence keeps it). The select
  policy shows a private task only to its creator, so the board and live updates hide it from
  the others, and every security definer function that acts on any open task skips other members' private ones.
  A private task is the creator's own to do: it is listed only in their My tasks (Me page), without picking it up,
  and has no Pick up or Put back. The Shared tasks board leaves out even the creator's
  own private tasks, and saving or deleting one returns to the Me page (Cancel on the task form goes back to the
  previous page). **Private tasks have no points** (`tasks_private_without_points`) and statistics count only
  shared tasks, both done and created (ADR 0006). A private task whose creator deletes their account or leaves
  stays hidden from everyone. On the form a "Private" toggle button comes first and, when pressed, hides what a
  private task doesn't need: who it is for, its type, points and "Already done". Its type is kept but never
  shown, also when editing.
- **Tasks for children**: `for_children` (default false: adults only), chosen first on the task form by adults
  ("Who is it for? Adults / Children", only on a new shared task once the family has children; the Private button
  makes way while Children is chosen, and editing can't move a task between the two); the next occurrence keeps
  it. Choosing Children shows the household's children instead of the rest of the form (`ChildPicker`, an only
  child's opening at once), and each opens that child's own form (`ChildTaskForm`, below), which then opens the
  child's page: parents found two forms for the same task confusing, so there is one. Its "Stars" are the points,
  picked 0–5 by tapping a row of five stars (tapping the last filled one again clears them); it has no type, labels
  or "Already done", and the board's form offers no earlier tasks for children to add again. **A shared task
  for children is the children's only**: parents wanted the children's chores kept apart from their own, so its stars always go to a
  child, and adults keep their own tasks (e.g. their own "Empty the dishwasher" with other points). Adults see,
  edit and delete them on each child's page (below), where saving one opens; the board lists only adults' shared
  tasks, as a list per child fits how parents set chores up. Adults can't pick one up, be asked to do one or mark
  one done: a trigger (`private.check_task_doer()`, using `private.can_do_task()`) refuses every way of picking up
  or marking done, `request_task()` asks only adults, for adults-only tasks (each task for children is a child's
  already), and making a task one for
  children, or a child becoming an adult, takes it back from adults with their reminders, plans and requests
  (`private.put_back_from_adults()`). An adult's own private tasks stay theirs to do. A child (ADR 0003) sees and
  acts only on tasks for children, and every task they add is one (insert policy; `update_task()` refuses a child
  making one adults-only). `private.can_see_task()` holds the visibility rule (household, private, children) for
  every security definer function acting on a task, reminders and undo included; the select policy spells the same
  rule out inline, since a function with `SET` isn't inlined and would stop the household index being used. A
  child never holds an adults-only task: making one adults-only, or marking its picker as a child, puts it back
  and removes their reminder (`private.put_back_adults_tasks()`), and `take_due_reminders()` never sends a child
  one; a new child's private tasks become theirs for children. Statistics and goals count every shared task for
  everyone (`household_statistics()`, `private.goal_points()` and `private.goal_member_points()` are security
  definer and return no task titles); a child's News lists only tasks for children.
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
- **Asking someone**: a member can ask another to do an open shared task that is free or that they picked up (handing
  it over). `task_requests` (one per task; asking again replaces it) is written only through `request_task()`,
  `answer_task_request()` and `cancel_task_request()` and is visible with its task; only members who may do the task
  can be asked (a child only a task for children). The member asked is notified (ADR 0005) and accepts, which picks
  the task up for them, or declines; nobody gets a task without saying yes, keeping the product's "self-assignment"
  principle (the one exception is a chore an adult gives a child, below). The card shows the request: Accept/Decline
  to the member asked (also under _Asked of you_ on the Me page), Cancel to whoever asked, and a decline only to
  whoever asked until dismissed. A trigger (`private.settle_task_requests()`) removes a request once the task is done
  or someone other than the member asked picks it up, and an accepted one once they give it back; the member asked
  picking the task up accepts it. Answering and cancelling lock the task before the request, like picking up, so they
  can't deadlock. Each function touches the task row, so live updates carry requests too.
- **Every task for children is one child's**: an open shared task for children is given to one child in the
  household (`assigned_to`, `tasks_childrens_given_to_a_child`; only for a shared task for children,
  `tasks_assigned_only_for_children`): a new one from that child's form, and "Whose chore is it?" when editing in a
  family with more than one child. Parents first asked for
  some chores to be one child's; once each child had their own page of tasks, a task for any child had no place left,
  so there are no such tasks (the migration gave each to the child who had it, was asked and didn't decline, or added
  it, else a copy to each child, which also counts as created; it removed those of families without children). A child's own shared task is theirs
  (`private.give_childs_task_to_them()`), and a task made adults-only is no longer given to anyone (`update_task()`).
  A trigger (`private.pick_up_for_assignee()`) picks it up for the child, also from whoever had it, so it is on their
  Me page with no new list. Requests and schedules are settled as for any change of hands; those triggers also fire on
  `assigned_to`, as an `UPDATE OF` trigger doesn't see columns a BEFORE trigger changes, and giving a task to a child
  settles its request even when the child already had it. It is the child's alone: they can't put it back
  (`put_back_task()`), nobody can be asked to do it (`request_task()`), and other children don't see it
  (`private.can_see_task()` and the select policy) nor are told it was added (`notify-household`), so neither can they
  act on it. Adults change the child by editing it (`update_task(task_assigned_to, task_change_assignee)`; a child's
  edit, or one from an app that doesn't send it yet, keeps it). Only adults give tasks, and only to a child in their
  household (`private.is_child_in_household()`, insert policy). The next occurrence goes to the same child. A child
  who becomes an adult, or is removed (`remove_child()`), takes their open chores with them: they go, as nobody else
  was meant to do them; done ones stay, no longer given to them, so undoing one can't reopen it given to an adult
  (a trigger on `household_members`; such an undo is refused, while a child undoing one given to nobody gets it,
  `undo_complete_task()`). Deleting a child's login any other way fails while they have open chores, as
  `assigned_to`'s `on delete set null` would leave them given to nobody.
- **Chores for several children**: there is no adding one task for several children at once: giving each their
  own copy (one insert, all or none) was dropped with the board form's tick boxes, as "Copy to Mia" on a child's
  page (below) does the same. Copies are separate tasks, so two children doing a chore together both earn its full
  stars, and nobody is credited for a sibling's work.
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
- **Labels** say what kind of chore a task is, so statistics can show how each kind of work is shared. A task has
  any number up to ten, ticked behind a "Choose labels" button: the app's ready-made ones (`taskLabelNames` in
  `src/lib/taskLabels.ts`, stored by name in `tasks.labels` like icons, read in each member's language; an older
  app drops names it doesn't know, also when it saves an edit, which we accept as apps update themselves) and the
  household's own (`tasks.custom_labels`, as typed, ≤ 30 characters). A label typed with a ready-made one's name
  in any of the app's languages picks that one, and one the household has used picks its spelling,
  so the same kind of chore isn't split. Own labels need no table: `custom_task_labels()` (security invoker, so RLS
  hides labels only on other members' private tasks) offers the 30 used most on tasks, like
  suggestions. `private.are_valid_task_labels()` checks the format and that each label appears once (own ones
  ignoring case). Insert, `update_task()` (`task_labels`, `task_custom_labels`; null keeps them), the next
  occurrence and `task_suggestions()` carry them; the card shows them after its other tags.
- **Screens for children** (`useIsChild()`; until known, a loading message, and if it can't be told, the adults'
  screens, which show a child only what they may see): the Me page (`src/app/MePage`) shows their open goals as
  star jars (ADR 0007), their own tasks as big tiles (`ChildTaskTiles`: icon, name, one star per point, a round
  Mark done button, Edit on ones they added), and their Completed list. Me is a child's only tab (`MainNav`,
  showing the others once the user is known to be an adult): one screen with nothing to filter keeps it simple, so
  they don't see who is doing the other tasks. Shared tasks, News, Rewards and Statistics, and the goal forms, send
  a child to their Me page (`SharedTasksPage`, `src/app/AdultsOnly`), where their jars show their goals' progress. Children's screens carry no hints or explanations. Adults' screens are unchanged. Points are still called points, as
  elsewhere.
- **Tasks without points**: an adult can give a shared task 0 points (`points` is 0–10), e.g. for a reminder like
  "Dentist on Thursday". It counts for nobody: `private.task_credits` leaves it out, so it adds no points or tasks
  done to statistics, goals or totals; `household_statistics()` doesn't count it as created; News (`fetchNews()`)
  leaves it out; and nobody can be credited for helping (`set_task_helpers()`). Null points keep their meaning
  (private, or a child's task waiting for points), so 0 is the explicit "none" rather than a new column. An adult
  may also award or edit a child's task to 0: what it's worth is theirs to decide. On the form a muted hint under the field appears at 0; the card simply
  shows no points badge, with no extra tag. Not called "reminder" in the app: that word already names reminders.
- **Points**: the Me screen shows the user's total points, summed when read (`own_total_points()`), not stored.
  Adding tasks earns nothing yet. Points also count towards goals (ADR 0007).
- **Helping**: an adult who marked a shared task with points done can say, for a week (as long as it is in the News),
  who helped them and give each helper bonus points (`task_helpers`, written only by `set_task_helpers()`, which
  replaces the helpers). Right after marking such a task done, a prompt ("Laundry done! Did someone help?") links to
  the form for a while, unless nobody else is in the household (`WhoHelpedPrompt`, found from TanStack Query's
  mutation state, since the card goes when the board refreshes); "Who helped?" on the Me page's Completed list offers
  it for the rest of the week. We ask after the tap rather than adding a "Do together" button to every card: a phone's
  action row is already full, and who helped is only known once the work is done. A bonus is 1–10 points (1 by default)
  **on top of** the task's, which the doer keeps: parents found that doing a chore with a child's help takes longer,
  so sharing out its points felt like a penalty. Bonuses do add to totals; the doer chooses them, and statistics show
  who did what. Only the doer chooses; a helper is any other member, also a child helping with an adults-only task
  (they get the points without seeing the task). **Children don't say who helped** (`set_task_helpers()` refuses
  them, and their screens have no prompt or link): the tasks they do are theirs. `private.task_credits` (a view only
  security definer functions read) credits the doer the task's points and each helper their bonus; statistics, goals
  and `own_total_points()` count it, and News adds up the same from the embedded helpers. Undoing a task removes its helpers; a repeat doesn't copy them. A helper's Me page
  lists the tasks they helped with among those they did ("You helped Anna", with their bonus), read with
  `own_helped_tasks()` (security definer): a child sees there the title of an adults-only task they helped with, and
  only there. The task stays off their board and News, and other children's, to keep a child's view simple.
- The board (the **Shared tasks** page) shows open shared tasks, soonest due first and tasks without a due date last (newest first within a date).
  It and the Me page's _To do_ group them under headings like an agenda (`groupByDueDate`): Overdue, Today, Tomorrow,
  each of the next five days by date, Later and No due date, leaving out empty groups. Grouping is done in the app
  from the same sorted list, with the user's local date; the board has no calendar grid, which needs far more room
  on a phone (the Me page offers one as an optional view, below).
  A **search** (`?q=`, `searchTasks()`) narrows the board to tasks whose title or description contains every word
  typed, ignoring case but keeping ä apart from a (different letters in Finnish and Swedish), so a family member can
  check whether a task already exists before adding it. It is done in the app on the tasks already loaded, and isn't
  remembered on the device: a forgotten search would hide tasks unnoticed. A hidden status region reads out how many
  tasks match while typing.
  The **filters** fold behind a button next to the search (`BoardFilters.tsx`), so the board starts with the tasks,
  not four rows of controls. While folded, each filter that is on shows as a chip with ✕ that turns it off, so a
  filter remembered from last time never hides tasks unnoticed; Statistics folds its filters into a `<details>`
  summary instead (ADR 0006), as it has no search to sit next to and a sentence reads better there. Unfolded there are
  two rows of chips without visible headings (the chips speak for themselves; the groups are named for screen
  readers), each with at most one chosen and tapping the chosen one again turning it off (an "All" or "Everyone"
  chip confused). A chosen adult's folded chip says "Picked up by Ben", as on a task card, since a bare name or
  "Picked up by: Available" read oddly:
  - **Due date** (`?show=`, `taskFilter.ts`): tasks due **Today** or **This week** (the next seven days, so it ends
    where "Later" begins; both include overdue tasks, which still need doing), or with **No due date**. None chosen
    shows all. Two due dates together would show nothing or the same as one.
  - **Picked up by**: **Available** (`?available=1`, nobody has picked them up), then **You** and the other adults in
    the order they joined (`?who=<user id>`, `pickerFilter.ts`). Only Available is offered to the only adult in the
    household, as children aren't offered (they can't pick up adults' tasks); a child or a member not in the household (any more) shows everyone's. Available and an adult
    exclude each other, as together they would always show nothing, hence one group.

  The two groups combine, e.g. what is due today and still free. These choices, like the Me page's view (`?view=`),
  are remembered on the device (ADR 0002), so the nav link brings them back; whether the filters are unfolded isn't.
  Each due-date group's heading is a button that folds its tasks away (`?<group>=hidden`, on the board and the Me
  page alike, remembered on the device), still showing how many there are, e.g. so an overdue backlog doesn't push
  today's tasks off the screen. The group's key stays the same from day to day (`overdue`, `today`, `tomorrow`,
  the weekday of one of the next five days, `later`, `undated`), so a folded group stays folded. Unlike the search
  it is remembered: the count keeps the folded tasks from going unnoticed.

- **Routines**: an everyday chore like emptying the dishwasher would fill the board as a card every day, so a
  repeating shared adults' task can be a **routine** (`is_routine`, a "Quick routine" check mark under Repeats;
  `tasks_routine_repeats` keeps it to repeating tasks, `update_task()` clears it when a task stops repeating, the
  next occurrence and "add again" keep it). The board shows routines as small chips above the due dates
  (`RoutineChips`) instead of cards: a due one is a button that marks it done with one tap (it looks the same when overdue, since a routine is never alarming; no
  confirmation even if someone picked it up, since anyone may do a routine), and one done until its next due date
  is a quiet chip saying who did it. Like the due-date groups, the section folds away behind its heading
  (`?routines=hidden`, remembered on the device), which still counts the routines left to do. Celebrating and "Who helped?" follow as for a card; undo is in the completed
  list as for any task. A search shows routines as ordinary cards, which is how one is found to edit it. We chose an
  explicit check mark over treating every daily task as a routine, because some daily tasks deserve a card.
- **Always tasks**: parents wanted a child's everyday chores (brushing teeth, making the bed) always on the child's
  Me page without setting due dates or repeats. An adult's shared task for children can be an **always task**
  (`is_always`, "Always" on the child's form, which hides Repeats and Due date; `tasks_always_for_children` keeps it
  to shared tasks for children without a repeat or due date; the insert policy and `update_task()` let only adults
  set it, a child's edit keeps it, and their form then shows no repeat or due date). It is one child's: the form
  asks for a child, as a pause and limit shared by several children would let one child's tap block another's.
  Marking one done adds a fresh copy at once (`complete_task()`, like a repeat's
  next occurrence, given to the same child, with its labels and pictures), so goals, News, undo and points done work
  as for any task; only its first row counts as created (ADR 0006). To stop
  double taps it can be done again only **2 minutes** after the previous copy was done (`ALWAYS_TASK_PAUSE_MS`), and
  at most `daily_limit` times a day (1–10, null for no limit; the form has "Times a day, at most" with a − [1] + stepper and a "No limit" switch beside it, which keeps the number while on). Each copy
  carries `times_done`/`times_done_on` (the doer's local date), so the limit costs no walk back through the copies.
  As `complete_task()` accepts the doer's date within a day of the server's, the limit is a parent's soft limit,
  not a hard one; the pause holds either way.
  The child's tile turns green with a filled check mark while it rests (a ring drains over the pause) and for the
  rest of the day once the limit is reached (it refreshes when the pause ends, at midnight and after a refused tap); always tiles come after the child's other tasks, by name, so a done
  one keeps its place. The adults' card shows "Always · 1× a day". We chose copies over one row with a separate
  completions table, which would have needed every report of done tasks to change.
- **Setting up a child's tasks**: parents wanted one place per child for their chores. A child's page, opened from
  their row on the family page (ADR 0003), lists them (`ChildTaskList`): the child's open tasks given to them, the always ones by name
  and then the custom ones (`childTaskList()`), each a row with when it comes up ("1× a day", "Every week · Mon 23
  Nov") and its stars, opening the edit form, which returns there (the child's id in the link's state, `returnToChild`: an id, not a path, so it can't lead off the app). Its plus opens a short form (`ChildTaskForm`): Always or Custom, then name (with the ready-made
  children's tasks), description, pictures, icon and stars (one to begin with), then "Times a day" or Repeats and
  Due date; who it is for isn't asked. It is the only form for adding an adult's task for children (the board's form
  leads here); an adult editing any shared task for children gets this form too (with whose it is), so a children's task can no longer be made an adults' one by editing. "Copy to Mia", shown for each other child who lacks some of the tasks, opens a page of tick boxes (`CopyChildTasksPage`): the tasks Mia lacks under the same name start ticked (each name once, `tasksToCopy()`), those she has can't be ticked, and "Copy 3 tasks" adds the chosen ones in one insert and returns with "Copied to Mia." Copies come without pictures, since only whoever uploaded a picture can attach it
  (`set_task_images()`).
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
  deleted tasks drop out on their own, and labels can later filter the same list.
- **Ready-made tasks**: so a new family needn't type every chore, the New task form offers everyday chores
  (`readyMadeTasks.ts`) to fill it in from and adjust, in the name field's list: tapped before a name is typed,
  it lists the household's five most often added earlier tasks and then the ready-made ones, and typing narrows
  both down (`nameSuggestions`, leaving out a ready-made one the household has its own of). They are the app's,
  not the household's: each has a name in every language (`taskForm.readyMade.titles`), a type, an icon and labels, and the list follows who the task is for, adults'
  chores or children's (their own things, simple jobs and helping an adult, e.g. "Help cook dinner"). The
  product owner chose the lists one by one; meta work is left to type, as it differs most between families. An adults' one starts with the user's default points and a children's with one star, to
  change before saving or later. Picking one fills in its name, type, icon, labels and points, keeping who the
  task is for (and which children) and whatever else was filled in. Nothing is added to the board by itself, so nobody is credited with creating
  tasks they didn't plan, and a list in the code needs no table or migration.
- **Default points**: an adult chooses in the settings ("New tasks") the points their new tasks start with, 0–10
  (3 until chosen). It is remembered on the device for each user, in localStorage like the language (`defaultPoints.ts`), as it only
  prefills a form; children don't choose points, so they don't see it.
- **Adding a task done already**: an "Already done" check mark on the New task form (not when adding from the
  timetable, which plans a task to do) adds the task and then marks it done with `complete_task()` as the user,
  so it is credited, celebrated and repeats exactly like one marked done from its card; it then has no due date
  (the field hides) and the Me page opens, where it is under Completed. An adult's task for children isn't offered
  it, as adults don't do those, nor is a private task, to keep its form short. Two requests rather than an insert with
  `completed_at`, so marking done keeps one path and the insert policy stays as it is. If marking done fails,
  the task stays open and its list opens with a notice to mark it done there (saving the form again would add it twice); if
  its pictures fail, its edit page opens as usual and it is marked done later.
- **Tasks from other apps**: a link to `/tasks/new?title=…&description=…&due=YYYY-MM-DD` fills in the New task
  form (`taskFromLink()`), so another app, such as the owner's email assistant, can hand over a task it found
  without any access to HomeFlow. The link only fills in the form: the user chooses the type, points and who it's
  for and saves it as usual, so the normal checks, RLS and push apply. A name or description too long to save is
  shortened and a due date that isn't a date is left out. A link opened while logged out is lost at the login.
- **Favourites**: before a name is typed, the form offers the household's favourite tasks by name instead of the
  most often added ones, which changed under the user and weren't what they wanted. They are folded away behind
  a Favourites button showing how many there are, closed each time, so a long list doesn't push the form down. A star by the name field stars
  or unstars the task being named, also a new one, saved straight away; so does a star on each open task card and
  on each done task in the board's and the Me page's Completed lists. Favourites are shared by the household:
  any member's star shows for everyone, and any member can remove it, also by pressing and holding a favourite
  on the form (or right-clicking it, or its context-menu key), which shows a Remove from favourites button.
  `favourite_tasks` stores only the name ignoring case (`title_key`), one row per member who starred it, so a star never reveals a private task: a member
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

- A "Show completed" switch on the board listing the household's 30 most recently done tasks, with Add again and a
  star: removed as unused. News shows what was done, the Me page lists one's own done tasks (undo, star), cards
  have a star, and the New task form suggests earlier tasks.
- Routines: every task repeating daily as a routine (no migration, but some daily tasks deserve a card); a long press
  on a chip to edit it, like favourites (a hidden gesture; the search already reaches the card).
- Labels: one per task (a chore is often two kinds, e.g. Kitchen and Cleaning); a household labels table (renaming
  or removing an own label would be easier, but it's more to manage, and a label nobody uses any more drops out
  on its own); only free text (ready-made labels in each member's language keep statistics comparable).
- Scheduling: a column on `tasks` (others would see your plans), native HTML drag and drop (doesn't work with
  touch), a timetable on the board (too little room on a phone).
- A calendar recurrence rule (doesn't move with late tasks), reopening the same row (loses who did each
  occurrence), creating the next occurrence from the app (two requests that can half-fail or race).
