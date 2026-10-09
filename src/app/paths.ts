export const paths = {
  tasks: '/',
  newTask: '/tasks/new',
  /** New task with the details of the earlier task named `title`. */
  addTaskAgain: (title: string) => `/tasks/new?again=${encodeURIComponent(title)}`,
  editTask: (taskId: string) => `/tasks/${taskId}/edit`,
  me: '/me',
  rewards: '/rewards',
  statistics: '/statistics',
  login: '/login',
  household: '/household',
  householdSetup: '/household/setup',
} as const;
