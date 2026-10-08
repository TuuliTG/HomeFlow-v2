export const paths = {
  tasks: '/',
  newTask: '/tasks/new',
  editTask: (taskId: string) => `/tasks/${taskId}/edit`,
  me: '/me',
  rewards: '/rewards',
  statistics: '/statistics',
  login: '/login',
  household: '/household',
  householdSetup: '/household/setup',
} as const;
