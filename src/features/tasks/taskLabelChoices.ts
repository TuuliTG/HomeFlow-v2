import type { NewTask } from '@/features/tasks/task';
import type { Messages } from '@/lib/i18n/i18n';
import {
  CUSTOM_LABEL_MAX_LENGTH,
  labelKey,
  MAX_TASK_LABELS,
  type TaskLabelName,
  taskLabelNames,
} from '@/lib/taskLabels';

/** A task's labels: the app's ready-made ones and the household's own. */
export type TaskLabels = Pick<NewTask, 'labels' | 'customLabels'>;

/** Whether the task can have another label (`MAX_TASK_LABELS`). */
export function canAddLabel({ labels, customLabels }: TaskLabels): boolean {
  return labels.length + customLabels.length < MAX_TASK_LABELS;
}

/** The task's labels with the ready-made one ticked or unticked, in the app's order. */
export function toggleLabel(chosen: TaskLabels, name: TaskLabelName): TaskLabels {
  const labels = chosen.labels.includes(name)
    ? chosen.labels.filter((label) => label !== name)
    : taskLabelNames.filter((label) => label === name || chosen.labels.includes(label));
  return { ...chosen, labels };
}

/** The task's labels with the household's own one ticked or unticked. */
export function toggleCustomLabel(chosen: TaskLabels, label: string): TaskLabels {
  const key = labelKey(label);
  const customLabels = chosen.customLabels.some((custom) => labelKey(custom) === key)
    ? chosen.customLabels.filter((custom) => labelKey(custom) !== key)
    : [...chosen.customLabels, label];
  return { ...chosen, customLabels };
}

/**
 * The task's labels with the one the user typed added: a ready-made label if it has that name in the user's
 * language, else one of the household's own (`known`) as it is spelled there, else a new one. Spaces around it
 * are dropped and it is cut to `CUSTOM_LABEL_MAX_LENGTH`; nothing changes for an empty name, a label the task
 * already has, or when it has as many as it can.
 */
export function addTypedLabel(
  chosen: TaskLabels,
  typed: string,
  { known, t }: { known: string[]; t: Messages },
): TaskLabels {
  const label = typed.trim().slice(0, CUSTOM_LABEL_MAX_LENGTH).trimEnd();
  const key = labelKey(label);
  if (key === '' || !canAddLabel(chosen)) return chosen;
  const readyMade = taskLabelNames.find((name) => labelKey(t.common.taskLabels[name]) === key);
  if (readyMade) {
    return chosen.labels.includes(readyMade) ? chosen : toggleLabel(chosen, readyMade);
  }
  if (chosen.customLabels.some((custom) => labelKey(custom) === key)) return chosen;
  const spelled = known.find((custom) => labelKey(custom) === key) ?? label;
  return toggleCustomLabel(chosen, spelled);
}

/**
 * The household's own labels to offer: those it has used, then any new ones on this task, each once ignoring
 * case.
 */
export function customLabelChoices(known: string[], chosen: TaskLabels): string[] {
  const knownKeys = new Set(known.map(labelKey));
  return [...known, ...chosen.customLabels.filter((label) => !knownKeys.has(labelKey(label)))];
}

/** The names of the task's labels in the user's language, ready-made ones first. */
export function labelNames({ labels, customLabels }: TaskLabels, t: Messages): string[] {
  return [...labels.map((name) => t.common.taskLabels[name]), ...customLabels];
}
