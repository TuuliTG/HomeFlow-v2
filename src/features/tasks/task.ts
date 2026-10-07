import { z } from 'zod';

export const taskTypes = ['physical', 'planning'] as const;

export type TaskType = (typeof taskTypes)[number];

export const taskTypeLabels: Record<TaskType, string> = {
  physical: 'Physical',
  planning: 'Planning',
};

export const TITLE_MAX_LENGTH = 80;

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
});

export type NewTask = z.infer<typeof newTaskSchema>;

export interface Task extends NewTask {
  id: string;
  /** User id of whoever added the task; null if they have deleted their account. */
  createdBy: string | null;
  /** Their display name, if they have chosen one. */
  creatorName: string | null;
}
