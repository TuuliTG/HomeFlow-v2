import type * as labelsApi from '@/features/tasks/labelsApi';
import { labelKey } from '@/lib/taskLabels';
import { isVisible, requestsFailing, tasks } from '@/test/fakeTasksBackend';

/** In-memory stand-in for `@/features/tasks/labelsApi`, installed for every unit test in `setup.ts`. */

/** Like `custom_task_labels()`: the household's own labels on tasks the user sees, each once, most used first. */
export const fetchCustomTaskLabels: typeof labelsApi.fetchCustomTaskLabels = () => {
  if (requestsFailing()) return Promise.reject(new Error('Network error'));
  const uses = new Map<string, { label: string; count: number }>();
  for (const task of tasks.filter(isVisible)) {
    for (const label of task.customLabels) {
      const key = labelKey(label);
      uses.set(key, { label, count: (uses.get(key)?.count ?? 0) + 1 });
    }
  }
  return Promise.resolve(
    [...uses.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .map(({ label }) => label),
  );
};
