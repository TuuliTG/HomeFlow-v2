import { z } from 'zod';

/**
 * The ready-made labels that say what kind of chore a task is, each read in the member's own language. The
 * database stores the name and checks only its format (ADR 0004), so the set can grow without a migration.
 */
export const taskLabelNames = [
  'kitchen',
  'cooking',
  'cleaning',
  'laundry',
  'tidying',
  'shopping',
  'children',
  'pets',
  'garden',
  'repairs',
  'paperwork',
  'car',
] as const;

export type TaskLabelName = (typeof taskLabelNames)[number];

/** How many labels, ready-made and own together, a task can have; `private.are_valid_task_labels()` enforces it. */
export const MAX_TASK_LABELS = 10;

/** How long a household's own label can be. */
export const CUSTOM_LABEL_MAX_LENGTH = 30;

function isTaskLabelName(name: string): name is TaskLabelName {
  return (taskLabelNames as readonly string[]).includes(name);
}

/** A task's ready-made labels; ones this version of the app doesn't know, e.g. added by a newer one, are left out. */
export const taskLabelsSchema = z
  .array(z.string())
  .transform((names) => names.filter(isTaskLabelName));

/** A label as `custom_task_labels()` groups them and a task holds each once: ignoring case and spaces around it. */
export function labelKey(label: string): string {
  return label.trim().toLowerCase();
}
