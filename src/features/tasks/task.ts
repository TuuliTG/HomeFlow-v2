import { z } from 'zod';

export const taskTypes = ['physical', 'meta'] as const;

export type TaskType = (typeof taskTypes)[number];

export const taskTypeLabels: Record<TaskType, string> = {
  physical: 'Physical',
  meta: 'Meta work',
};

export const TITLE_MAX_LENGTH = 80;
export const DESCRIPTION_MAX_LENGTH = 500;

/** How many recently done tasks the board shows with "Show completed". */
export const HOUSEHOLD_COMPLETED_LIMIT = 30;

/** How long after marking a task done the user can undo it; `undo_complete_task()` enforces it. */
export const UNDO_WINDOW_MS = 60 * 60 * 1000;

/** How often a task can repeat, in days; offered as choices when creating a task. */
export const repeatChoices = [1, 2, 3, 7, 14, 30] as const;

/** "Every day", "Every 3 days", "Every week", "Every 2 weeks". */
export function repeatLabel(days: number): string {
  if (days === 1) return 'Every day';
  if (days === 7) return 'Every week';
  if (days % 7 === 0) return `Every ${String(days / 7)} weeks`;
  return `Every ${String(days)} days`;
}

export const newTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Give the task a name.')
      .max(TITLE_MAX_LENGTH, `Keep the name to ${TITLE_MAX_LENGTH} characters or fewer.`),
    /** More detail when the title isn't enough; null when there is none. */
    description: z
      .string()
      .trim()
      .min(1)
      .max(
        DESCRIPTION_MAX_LENGTH,
        `Keep the description to ${String(DESCRIPTION_MAX_LENGTH)} characters or fewer.`,
      )
      .nullable(),
    type: z.enum(taskTypes),
    /** Null for a private task: only shared tasks earn points. */
    points: z.coerce
      .number()
      .int('Points must be a whole number from 1 to 10.')
      .min(1, 'Points must be a whole number from 1 to 10.')
      .max(10, 'Points must be a whole number from 1 to 10.')
      .nullable(),
    /** Days after it is done that the task comes back; null for a one-off task. */
    repeatEveryDays: z.number().int().min(1).max(365).nullable(),
    /** Local date (YYYY-MM-DD) the task should be done by, if any. */
    dueOn: z.iso.date('Pick a valid due date.').nullable(),
    /**
     * Seen only by whoever added it, not shared with the family. Chosen when adding the task. Private
     * tasks have no points and don't count in statistics.
     */
    isPrivate: z.boolean(),
  })
  .refine((task) => (task.points === null) === task.isPrivate, {
    path: ['points'],
    message: 'Only shared tasks have points.',
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

/** A task the household has added before, to add again with the same details (`task_suggestions()`). */
export interface TaskSuggestion extends Omit<NewTask, 'dueOn'> {
  /** How many times members have added it; repeats a task adds itself don't count. */
  timesAdded: number;
  /** Whether it is on the board now, not yet done. */
  isOpen: boolean;
}

/** A task the user has marked done. */
export interface CompletedTask {
  id: string;
  title: string;
  type: TaskType;
  /** Null for a private task. */
  points: number | null;
  /** When it was marked done (ISO timestamp). */
  completedAt: string;
}

/** A task someone in the household has marked done. */
export interface HouseholdCompletedTask extends CompletedTask {
  completedBy: string | null;
  /** Their display name, if they have chosen one. */
  completerName: string | null;
}
