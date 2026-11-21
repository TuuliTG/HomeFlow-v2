/** The task board, task cards and the Me page. */
export const tasks = {
  newTask: 'New task',
  board: {
    title: 'Shared tasks',
    /**
     * Which list the board shows adults: their own tasks, or the tasks for children, which adults only check
     * and edit; children do them. The legend is for screen readers.
     */
    lists: {
      legend: 'Whose tasks',
      adults: 'Adults',
      children: 'Children',
    },
    noChildrens: 'No tasks for children yet. Create the first one!',
    /** The board's filters, behind a button next to the search. */
    filtersButton: 'Filters',
    /** The label of a chip that turns a filter off while the filters are folded. */
    removeFilter: (filter: string) => `Remove filter: ${filter}`,
    /** The filter by due date, for screen readers. */
    dueDate: 'Due date',
    /** The filter by who has picked tasks up, for screen readers; its chip says `card.pickedUpBy` while folded. */
    who: 'Picked up by',
    you: 'You',
    search: 'Search tasks',
    noMatches: (search: string) => `No tasks match “${search}”.`,
    /** Read out by screen readers while searching. */
    matches: (count: number) => (count === 1 ? '1 task found' : `${String(count)} tasks found`),
    loadFailed: "We couldn't load the tasks. Check your connection and reload the page.",
    filters: {
      today: 'Today',
      week: 'This week',
      undated: 'No due date',
    },
    /** What the board says when the filter leaves nothing to show. */
    empty: {
      all: 'No tasks yet. Create the first one!',
      today: 'Nothing is due today.',
      week: 'Nothing is due this week.',
      undated: 'Every task has a due date.',
    },
    /** Only the tasks nobody has picked up; one of the choices in the filter by who has picked tasks up. */
    available: 'Available',
    /** What the board says when nothing is left to pick up within the filter. */
    emptyAvailable: {
      all: 'Every task has been picked up.',
      today: 'Everything due today has been picked up.',
      week: 'Everything due this week has been picked up.',
      undated: 'Every task without a due date has been picked up.',
    },
    /** When nothing shown is picked up by the member chosen. */
    noneFor: (name: string) => `${name} has no tasks picked up here.`,
    noneForYou: 'You have no tasks picked up here.',
  },
  due: {
    today: 'Due today',
    tomorrow: 'Due tomorrow',
    on: (date: string) => `Due ${date}`,
    was: (date: string) => `Was due ${date}`,
  },
  dueGroups: {
    overdue: 'Overdue',
    later: 'Later',
    noDueDate: 'No due date',
  },
  /** Everyday chores shown as chips marked done with one tap. */
  routines: {
    heading: 'Routines',
  },
  /** "Every day", "Every 3 days", "Every week", "Every 2 weeks". */
  repeat: (days: number) => {
    if (days === 1) return 'Every day';
    if (days === 7) return 'Every week';
    if (days % 7 === 0) return `Every ${String(days / 7)} weeks`;
    return `Every ${String(days)} days`;
  },
  award: {
    heading: 'Waiting for points',
    notDoneYet: 'Not done yet',
    doneBy: (name: string) => `Done by ${name}`,
    pointsFor: (title: string) => `Points for ${title}`,
    award: 'Award',
    awardLabel: (title: string) => `Award points: ${title}`,
    failed: "We couldn't award the points. Try again.",
  },
  card: {
    private: 'Private',
    forChildren: 'For children',
    /** A task an adult gave to one child. */
    onlyFor: (name: string) => `Only for ${name}`,
    /** An always task, with how many times a day it earns its points; null for no limit. */
    always: (dailyLimit: number | null) =>
      dailyLimit === null ? 'Always' : `Always · ${String(dailyLimit)}× a day`,
    waitingForPoints: 'Waiting for points',
    /** A suggested shared task with 0 points, which counts for nobody. */
    noPoints: 'No points',
    addedBy: {
      you: 'Added by you',
      someone: 'Added by someone',
      named: (name: string) => `Added by ${name}`,
    },
    pickedUpBy: {
      you: 'Picked up by you',
      someone: 'Picked up by someone',
      named: (name: string) => `Picked up by ${name}`,
    },
    /** Who marked the previous occurrence of a repeating task done, and when (`daysAgo`). */
    lastDoneBy: (when: string) => ({
      you: `Last done by you, ${when}`,
      someone: `Last done by someone, ${when}`,
      named: (name: string) => `Last done by ${name}, ${when}`,
    }),
    daysAgo: (days: number) => {
      if (days === 0) return 'today';
      if (days === 1) return 'yesterday';
      return `${String(days)} days ago`;
    },
    images: (title: string) => `Pictures: ${title}`,
    /** The link opening a picture full size. */
    image: (position: number, title: string) =>
      `Picture ${String(position)} of ${title} (opens in a new tab)`,
    imagesFailed: "We couldn't load the pictures.",
    edit: 'Edit',
    editLabel: (title: string) => `Edit: ${title}`,
    pickUp: 'Pick up',
    putBack: 'Put back',
    markDone: 'Mark done',
    /** An always task done just now, or as often as it may be today. */
    doneForNow: 'Done',
    failures: {
      complete: "We couldn't mark the task done. Try again.",
      pickUp: "We couldn't pick up the task. Someone may have taken it first.",
      putBack: "We couldn't put the task back. Try again.",
    },
    confirmTakeOverLabel: (name: string) => `Mark done for ${name}?`,
    confirmTakeOver: (name: string) => `${name} has picked this up. Mark it done anyway?`,
    yesIDidIt: 'Yes, I did it',
  },
  favourite: 'Favourite',
  favouriteLabel: (title: string) => `Favourite: ${title}`,
  notSaved: 'Not saved',
  completed: {
    doneBy: {
      you: 'Done by you',
      someone: 'Done by someone',
      named: (name: string) => `Done by ${name}`,
    },
  },
  me: {
    title: 'My tasks',
    pointsEarned: 'Points earned',
    pointsLoadFailed: "We couldn't load your points.",
    toDo: 'To do',
    loadFailed: "We couldn't load your tasks. Check your connection and reload the page.",
    nothingPickedUp: 'Nothing picked up yet.',
    completed: 'Completed',
    completedTasks: 'Completed tasks',
    completedLoadFailed:
      "We couldn't load your completed tasks. Check your connection and reload the page.",
    completedEmpty: 'Nothing done yet.',
    doneOn: (date: string) => `Done ${date}`,
    undo: 'Undo',
    undoLabel: (title: string) => `Undo: ${title}`,
    undoFailed:
      "We couldn't undo this. Tasks can be undone for an hour, before their next one is done.",
    /** Under a task the user helped someone else with. */
    youHelped: (name: string) => `You helped ${name}`,
  },
  /** The Me page for children: their tasks as big tiles, and tasks to pick. */
  /** An adult's page of one child's own tasks (`ChildTasksPage`). */
  childTasks: {
    title: (name: string) => `${name}'s tasks`,
    add: (name: string) => `Add a task for ${name}`,
    newTitle: (name: string) => `New task for ${name}`,
    kindLegend: 'Kind of task',
    kinds: { always: 'Always', custom: 'Custom' },
    empty: 'No tasks yet.',
    notFound: 'This child is not in your family.',
    timesADay: (times: number | null) => (times === null ? 'No limit' : `${String(times)}× a day`),
    once: 'Once',
    copyTo: (name: string) => `Copy to ${name}`,
    copied: (name: string) => `Copied to ${name}.`,
    copyFailed: "We couldn't copy the tasks. Try again.",
  },
  child: {
    title: 'My stars',
    myTasks: 'My tasks',
    nothingToDo: 'Nothing to do yet.',
    free: 'Free to pick',
    nothingFree: 'No free tasks right now.',
  },
  /** Saying who helped with a task the user did, and giving them bonus points. */
  helpers: {
    title: 'Who helped?',
    description: (title: string, points: string) =>
      `Give whoever helped with ${title} bonus points. You still get all its ${points}.`,
    whoHelped: 'Who helped?',
    whoHelpedLabel: (title: string) => `Who helped with ${title}?`,
    helped: (name: string) => `${name} helped`,
    bonusFor: (name: string) => `Bonus points for ${name}`,
    youKeep: (points: string) => `You keep all ${points}; bonuses come on top.`,
    noOneElse: 'Nobody else is in your household yet.',
    unavailable: 'You can say who helped for a week after marking a shared task with points done.',
    loadFailed:
      "We couldn't load the task and your household. Check your connection and reload the page.",
    saveFailed: "We couldn't save who helped. Try again.",
    /** The prompt that appears after marking a task done. */
    askAfterDone: (title: string) => `${title} done! Did someone help?`,
  },
  /** Asking another member to do a task, and answering when asked. */
  requests: {
    ask: 'Ask',
    askLabel: (title: string) => `Ask someone to do ${title}`,
    title: 'Ask someone',
    whoToAsk: 'Who to ask',
    send: 'Send request',
    noOne: 'Nobody else in your household can do this task.',
    unavailable:
      'This task can no longer be asked of anyone: it may be done, or someone else has picked it up.',
    loadFailed:
      "We couldn't load the task and your household. Check your connection and reload the page.",
    sendFailed: "We couldn't send the request. Try again.",
    /** The Me page's list of tasks waiting for the user's answer. */
    askedOfYou: 'Asked of you',
    askedYou: (name: string) => `${name} asked you to do this.`,
    youAsked: (name: string) => `You asked ${name} to do this.`,
    asked: (requester: string, asked: string) => `${requester} asked ${asked} to do this.`,
    declined: (name: string) => `${name} can't do this.`,
    accept: 'Accept',
    acceptLabel: (title: string) => `Accept: ${title}`,
    decline: 'Decline',
    declineLabel: (title: string) => `Decline: ${title}`,
    cancel: 'Cancel request',
    cancelLabel: (title: string) => `Cancel request: ${title}`,
    dismiss: 'OK',
    dismissLabel: (title: string) => `OK, dismiss: ${title}`,
    answerFailed: "We couldn't save your answer. The task may be done or taken already.",
    cancelFailed: "We couldn't cancel the request. Try again.",
  },
  /** The short celebration when the user marks a task done. */
  celebration: {
    done: (title: string) => `${title} done!`,
    /** "+3 points": what the task earned. */
    pointsEarned: (points: string) => `+${points}`,
  },
  activity: {
    added: (name: string, title: string) => `${name} added ${title}`,
    dismiss: 'Dismiss',
  },
};
