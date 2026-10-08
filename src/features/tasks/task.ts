import { z } from 'zod';

export const taskTypes = ['physical', 'planning'] as const;

export type TaskType = (typeof taskTypes)[number];

export const taskTypeLabels: Record<TaskType, string> = {
  physical: 'Physical',
  planning: 'Planning',
};

export const TITLE_MAX_LENGTH = 80;

/** How often a task can repeat, in days; offered as choices when creating a task. */
export const repeatChoices = [1, 2, 3, 7, 14, 30] as const;

/** "Every day", "Every 3 days", "Every week", "Every 2 weeks". */
export function repeatLabel(days: number): string {
  if (days === 1) return 'Every day';
  if (days === 7) return 'Every week';
  if (days % 7 === 0) return `Every ${String(days / 7)} weeks`;
  return `Every ${String(days)} days`;
}

export const newTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give the task a name.')
    .max(TITLE_MAX_LENGTH, `Keep the name to ${TITLE_MAX_LENGTH} characters or fewer.`),
  type: z.enum(taskTypes),
  points: z.coerce
    .number()
    .int('Points must be a whole number from 1 to 10.')
    .min(1, 'Points must be a whole number from 1 to 10.')
    .max(10, 'Points must be a whole number from 1 to 10.'),
  /** Days after it is done that the task comes back; null for a one-off task. */
  repeatEveryDays: z.number().int().min(1).max(365).nullable(),
  /** Local date (YYYY-MM-DD) the task should be done by, if any. */
  dueOn: z.iso.date('Pick a valid due date.').nullable(),
});

export type NewTask = z.infer<typeof newTaskSchema>;

export interface Task extends NewTask {
  id: string;
  /** User id of whoever added the task; null if they have deleted their account. */
  createdBy: string | null;
  /** Their display name, if they have chosen one. */
  creatorName: string | null;
  /** User id of whoever has picked the task up to do it, if anyone. */
  pickedUpBy: string | null;
  /** Their display name, if they have chosen one. */
  pickerName: string | null;
}

/** A task the user has marked done. */
export interface CompletedTask {
  id: string;
  title: string;
  type: TaskType;
  points: number;
  /** When it was marked done (ISO timestamp). */
  completedAt: string;
}
