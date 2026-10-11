/** The task board, task cards and the Me page. */
export const tasks = {
  eyebrow: 'Tasks',
  newTask: 'New task',
  board: {
    title: 'Shared tasks',
    description:
      'Pick any task. New tasks earn bonus points for variety and fairness. Your private tasks are on your Me page.',
    showCompleted: 'Show completed',
    show: 'Show',
    loadFailed: "We couldn't load the tasks. Check your connection and reload the page.",
    filters: {
      all: 'All',
      today: 'Today',
      week: 'This week',
      undated: 'No due date',
      available: 'Available',
    },
    /** What the board says when the filter leaves nothing to show. */
    empty: {
      all: 'No tasks yet. Create the first one!',
      today: 'Nothing is due today.',
      week: 'Nothing is due this week.',
      undated: 'Every task has a due date.',
      available: 'Every task has been picked up.',
    },
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
  /** "Every day", "Every 3 days", "Every week", "Every 2 weeks". */
  repeat: (days: number) => {
    if (days === 1) return 'Every day';
    if (days === 7) return 'Every week';
    if (days % 7 === 0) return `Every ${String(days / 7)} weeks`;
    return `Every ${String(days)} days`;
  },
  card: {
    private: 'Private',
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
    edit: 'Edit',
    editLabel: (title: string) => `Edit: ${title}`,
    pickUp: 'Pick up',
    putBack: 'Put back',
    markDone: 'Mark done',
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
    heading: 'Completed',
    loadFailed: "We couldn't load the completed tasks. Check your connection and reload the page.",
    empty: 'Nothing done yet.',
    doneBy: {
      you: 'Done by you',
      someone: 'Done by someone',
      named: (name: string) => `Done by ${name}`,
    },
    addAgain: 'Add again',
    addAgainLabel: (title: string) => `Add ${title} again`,
  },
  me: {
    eyebrow: 'Me',
    title: 'My tasks',
    description: "Things you've picked up, your private tasks and what you've completed.",
    pointsEarned: 'Points earned',
    pointsLoadFailed: "We couldn't load your points.",
    toDo: 'To do',
    loadFailed: "We couldn't load your tasks. Check your connection and reload the page.",
    nothingPickedUp: 'Nothing picked up yet. Pick a task on the board.',
    completed: 'Completed',
    completedTasks: 'Completed tasks',
    completedLoadFailed:
      "We couldn't load your completed tasks. Check your connection and reload the page.",
    completedEmpty: 'Tasks you mark done will show up here.',
    doneOn: (date: string) => `Done ${date}`,
    undo: 'Undo',
    undoLabel: (title: string) => `Undo: ${title}`,
    undoFailed:
      "We couldn't undo this. Tasks can be undone for an hour, before their next one is done.",
  },
  activity: {
    added: (name: string, title: string) => `${name} added ${title}`,
    dismiss: 'Dismiss',
  },
};
