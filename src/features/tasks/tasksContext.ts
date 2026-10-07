import { createContext, useContext } from 'react';

import type { NewTask, Task } from '@/features/tasks/task';

export interface TasksState {
  tasks: Task[];
  addTask: (task: NewTask) => void;
}

export const TasksContext = createContext<TasksState | null>(null);

export function useTasks(): TasksState {
  const tasks = useContext(TasksContext);
  if (!tasks) throw new Error('useTasks must be used inside <TasksProvider>');
  return tasks;
}
