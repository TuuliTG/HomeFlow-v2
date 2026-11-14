import { repeatChoices } from '@/features/tasks/task';

/** The units a custom repeat interval is counted in. */
export const repeatUnits = ['days', 'weeks'] as const;
export type RepeatUnit = (typeof repeatUnits)[number];

const DAYS_IN: Record<RepeatUnit, number> = { days: 1, weeks: 7 };

/** The "Repeats" choice that asks for an interval of the user's own. */
export const CUSTOM_REPEAT = 'custom';

/** How often a task repeats, as the form's fields hold it. */
export interface RepeatFieldValue {
  /** '' for a one-off task, one of `repeatChoices` as a string, or `CUSTOM_REPEAT`. */
  choice: string;
  /** The custom interval, counted in `unit`s, as typed. */
  count: string;
  unit: RepeatUnit;
}

function isRepeatChoice(days: number): boolean {
  return repeatChoices.some((choice) => choice === days);
}

/** The fields' values for a task repeating every `days` days, or not at all (null). */
export function repeatFieldValue(days: number | null): RepeatFieldValue {
  if (days === null) return { choice: '', count: '', unit: 'days' };
  if (isRepeatChoice(days)) return { choice: String(days), count: '', unit: 'days' };
  const unit = days % 7 === 0 ? 'weeks' : 'days';
  return { choice: CUSTOM_REPEAT, count: String(days / DAYS_IN[unit]), unit };
}

/**
 * The days between occurrences the fields describe, or null for a one-off task. A custom count that
 * isn't a number gives NaN, for `newTaskSchema` to reject.
 */
export function repeatDays({ choice, count, unit }: RepeatFieldValue): number | null {
  if (choice === '') return null;
  if (choice !== CUSTOM_REPEAT) return Number(choice);
  return count.trim() === '' ? Number.NaN : Number(count) * DAYS_IN[unit];
}
