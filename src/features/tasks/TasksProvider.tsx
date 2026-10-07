import { type ReactNode, useMemo, useState } from 'react';

import type { Task } from '@/features/tasks/task';
import { TasksContext, type TasksState } from '@/features/tasks/tasksContext';

interface TasksProviderProps {
  children: ReactNode;
}

/**
 * Front-end-only task store: tasks live in memory and are lost on reload.
 * Replace with a TanStack Query hook over a Supabase-backed `api.ts`.
 */
export function TasksProvider({ children }: TasksProviderProps) {
  const [tasks, setTasks] = useState<Task[]>([]);

  const state = useMemo<TasksState>(
    () => ({
      tasks,
      addTask: (task) => {
        setTasks((current) => [{ ...task, id: crypto.randomUUID() }, ...current]);
      },
    }),
    [tasks],
  );

  return <TasksContext value={state}>{children}</TasksContext>;
}
