import type { TaskType } from '@/features/tasks/task';

/** A timetable block's colours by the task's type: meta work is purple, as everywhere. */
export const typeColours: Record<TaskType, string> = {
  physical: 'border-brand-600 bg-brand-50 text-brand-900',
  meta: 'border-purple-600 bg-purple-100 text-purple-900',
};
