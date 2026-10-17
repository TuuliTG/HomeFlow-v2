export const paths = {
  tasks: '/',
  newTask: '/tasks/new',
  /** New task with the details of the earlier task named `title`. */
  addTaskAgain: (title: string) => `/tasks/new?again=${encodeURIComponent(title)}`,
  /** New task that goes in the user's timetable from `startsAt` (ISO timestamp), back on its `view` once added. */
  newTaskAt: (startsAt: string, view: string) =>
    `/tasks/new?at=${encodeURIComponent(startsAt)}&view=${view}`,
  /** The Me page with its tasks to do shown as `view` (list, day or week). */
  meAs: (view: string) => `/me?view=${view}`,
  editTask: (taskId: string) => `/tasks/${taskId}/edit`,
  /** Who helped with a task the user marked done. */
  taskHelpers: (taskId: string) => `/tasks/${taskId}/helpers`,
  /** Where a task is listed: private tasks only on the Me page, shared ones on the board. */
  taskList: (isPrivate: boolean) => (isPrivate ? '/me' : '/'),
  me: '/me',
  news: '/news',
  rewards: '/rewards',
  newGoal: '/rewards/new',
  editGoal: (goalId: string) => `/rewards/${goalId}/edit`,
  statistics: '/statistics',
  login: '/login',
  household: '/household',
  householdSetup: '/household/setup',
} as const;
