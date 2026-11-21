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
   * Where a task is listed: private tasks only on the Me page, a child's on their member page, the others on the
   * board. Both of the last are adults' pages, which send a child to their Me page.
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
    return forChildren && assignedTo !== null ? `/household/members/${assignedTo}` : '/';
  },
  /**
   * An adult's page of another member: for a child, their tasks and settings (ADR 0004); for an adult, whether
   * they are a child.
   */
  member: (memberId: string) => `/household/members/${memberId}`,
  newChildTask: (childId: string) => `/household/members/${childId}/new-task`,
  /** Choosing which of a child's tasks to copy to another child. */
  copyChildTasks: (fromChildId: string, toChildId: string) =>
    `/household/members/${fromChildId}/copy/${toChildId}`,
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
