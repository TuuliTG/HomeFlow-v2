export const paths = {
  tasks: '/',
  newTask: '/tasks/new',
  /** New task with the details of the earlier task named `title`. */
  /** New task that goes in the user's timetable from `startsAt` (ISO timestamp), back on its `view` once added. */
  newTaskAt: (startsAt: string, view: string) =>
    `/tasks/new?at=${encodeURIComponent(startsAt)}&view=${view}`,
  /** The Me page with its tasks to do shown as `view` (list, day or week). */
  meAs: (view: string) => `/me?view=${view}`,
  editTask: (taskId: string) => `/tasks/${taskId}/edit`,
  /** Asking another member to do a task. */
  askForTask: (taskId: string) => `/tasks/${taskId}/ask`,
  /** Who helped with a task the user marked done. */
  taskHelpers: (taskId: string) => `/tasks/${taskId}/helpers`,
  /**
   * Where a task is listed: private tasks only on the Me page, a child's on their page of tasks, the others on the
   * board (which sends a child to their Me page).
   */
  taskList: ({
    isPrivate,
    forChildren,
    assignedTo,
  }: {
    isPrivate: boolean;
    forChildren: boolean;
    assignedTo: string | null;
  }) => {
    if (isPrivate) return '/me';
    return forChildren && assignedTo !== null ? `/children/${assignedTo}/tasks` : '/';
  },
  /** An adult's page of one child's own tasks, to set them up (ADR 0004). */
  childTasks: (childId: string) => `/children/${childId}/tasks`,
  newChildTask: (childId: string) => `/children/${childId}/tasks/new`,
  /** Choosing which of a child's tasks to copy to another child. */
  copyChildTasks: (fromChildId: string, toChildId: string) =>
    `/children/${fromChildId}/tasks/copy/${toChildId}`,
  me: '/me',
  news: '/news',
  rewards: '/rewards',
  newGoal: '/rewards/new',
  editGoal: (goalId: string) => `/rewards/${goalId}/edit`,
  statistics: '/statistics',
  settings: '/settings',
  login: '/login',
  household: '/household',
  householdSetup: '/household/setup',
} as const;
