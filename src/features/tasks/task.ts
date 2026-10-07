import { z } from 'zod';

export const taskTypes = ['physical', 'planning'] as const;

export type TaskType = (typeof taskTypes)[number];

export const taskTypeLabels: Record<TaskType, string> = {
  physical: 'Physical',
  planning: 'Planning',
};

export const newTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give the task a name.')
    .max(80, 'Keep the name under 80 characters.'),
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
}
