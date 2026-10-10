export const paths = {
  tasks: '/',
  newTask: '/tasks/new',
  /** New task with the details of the earlier task named `title`. */
  addTaskAgain: (title: string) => `/tasks/new?again=${encodeURIComponent(title)}`,
  editTask: (taskId: string) => `/tasks/${taskId}/edit`,
  /** Where a task is listed: private tasks only on the Me page, shared ones on the board. */
  taskList: (isPrivate: boolean) => (isPrivate ? '/me' : '/'),
  me: '/me',
  news: '/news',
  rewards: '/rewards',
  newGoal: '/rewards/new',
  statistics: '/statistics',
  login: '/login',
  household: '/household',
  householdSetup: '/household/setup',
} as const;
