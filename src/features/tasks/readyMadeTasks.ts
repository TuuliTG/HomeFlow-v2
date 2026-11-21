import {
  DEFAULT_POINTS,
  NEW_TASK_DEFAULTS,
  type TaskSuggestion,
  type TaskType,
  titleKey,
} from '@/features/tasks/task';
import { type Messages, useMessages } from '@/lib/i18n/i18n';
import type { TaskIconName } from '@/lib/taskIcons';
import type { TaskLabelName } from '@/lib/taskLabels';

interface ReadyMadeTask {
  /** Names it in `taskForm.readyMade.titles`, in the user's language. */
  key: keyof Messages['taskForm']['readyMade']['titles'];
  type: TaskType;
  icon: TaskIconName;
  labels: TaskLabelName[];
}

/** Everyday chores a family can add with one tap from the New task form, then adjust (ADR 0004). */
const forAdults: ReadyMadeTask[] = [
  { key: 'emptyDishwasher', type: 'physical', icon: 'dishes', labels: ['kitchen'] },
  { key: 'takeOutRubbish', type: 'physical', icon: 'trash', labels: ['cleaning'] },
  { key: 'doLaundry', type: 'physical', icon: 'laundry', labels: ['laundry'] },
  { key: 'foldLaundry', type: 'physical', icon: 'clothes', labels: ['laundry'] },
  { key: 'vacuum', type: 'physical', icon: 'vacuum', labels: ['cleaning'] },
  { key: 'mopFloors', type: 'physical', icon: 'cleaning', labels: ['cleaning'] },
  { key: 'dust', type: 'physical', icon: 'cleaning', labels: ['cleaning'] },
  { key: 'cleanBathroom', type: 'physical', icon: 'bath', labels: ['cleaning'] },
  { key: 'cleanKitchen', type: 'physical', icon: 'cleaning', labels: ['kitchen'] },
  { key: 'changeBedSheets', type: 'physical', icon: 'bed', labels: ['laundry'] },
  { key: 'cookDinner', type: 'physical', icon: 'cooking', labels: ['cooking'] },
  { key: 'waterPlants', type: 'physical', icon: 'plants', labels: ['garden'] },
  { key: 'walkDog', type: 'physical', icon: 'dog', labels: ['pets'] },
];

/** Chores suited to children: their own things, simple jobs and helping an adult. */
const forChildren: ReadyMadeTask[] = [
  { key: 'tidyRoom', type: 'physical', icon: 'toys', labels: ['tidying'] },
  { key: 'makeBed', type: 'physical', icon: 'bed', labels: ['tidying'] },
  { key: 'setTable', type: 'physical', icon: 'table', labels: ['kitchen'] },
  { key: 'clearTable', type: 'physical', icon: 'dishes', labels: ['kitchen'] },
  { key: 'putAwayClothes', type: 'physical', icon: 'clothes', labels: ['laundry'] },
  { key: 'emptyDishwasher', type: 'physical', icon: 'dishes', labels: ['kitchen'] },
  { key: 'takeOutRubbish', type: 'physical', icon: 'trash', labels: ['cleaning'] },
  { key: 'vacuumRoom', type: 'physical', icon: 'vacuum', labels: ['cleaning'] },
  { key: 'helpFoldLaundry', type: 'physical', icon: 'laundry', labels: ['laundry'] },
  { key: 'helpCookDinner', type: 'physical', icon: 'cooking', labels: ['cooking'] },
];

/** The stars a ready-made task for children earns, whatever an adult's default points. */
const READY_MADE_CHILD_STARS = 1;

interface ReadyMadeOptions {
  /** Children's chores rather than adults'. */
  isForChildren: boolean;
  /** Whether the user is adding a private task, which keeps it private and without points. */
  isPrivate: boolean;
  /** The points an adults' task starts with (the user's default, `useDefaultPoints`). */
  defaultPoints: number;
  /** The household's earlier tasks: one with the same name says whether it is on the board now. */
  earlier: TaskSuggestion[];
  t: Messages;
}

/**
 * The ready-made tasks for adults or for children, as suggestions to fill in the form with, named in the user's
 * language. An adults' task earns the default points, a children's one star, and a private one none.
 */
export function readyMadeTasks({
  isForChildren,
  isPrivate,
  defaultPoints,
  earlier,
  t,
}: ReadyMadeOptions): TaskSuggestion[] {
  const openKeys = new Set(
    earlier.filter((task) => task.isOpen).map((task) => titleKey(task.title)),
  );
  return (isForChildren ? forChildren : forAdults).map(({ key, type, icon, labels }) => {
    const title = t.taskForm.readyMade.titles[key];
    return {
      ...NEW_TASK_DEFAULTS,
      title,
      description: null,
      type,
      icon,
      labels,
      forChildren: isForChildren,
      isPrivate,
      points: pointsOf({ isForChildren, isPrivate, defaultPoints }),
      timesAdded: 0,
      isOpen: openKeys.has(titleKey(title)),
    };
  });
}

function pointsOf({
  isForChildren,
  isPrivate,
  defaultPoints,
}: Pick<ReadyMadeOptions, 'isForChildren' | 'isPrivate' | 'defaultPoints'>): number | null {
  if (isPrivate) return null;
  return isForChildren ? READY_MADE_CHILD_STARS : defaultPoints;
}

interface ReadyMadeOnForm extends Omit<ReadyMadeOptions, 't' | 'defaultPoints'> {
  /** Ready-made tasks are offered only on a new task, not when editing one. */
  isNew: boolean;
  defaultPoints: number | undefined;
}

/** The ready-made tasks the task form offers, in the user's language; none when editing. */
export function useReadyMadeTasks({
  isNew,
  defaultPoints = DEFAULT_POINTS,
  ...options
}: ReadyMadeOnForm): TaskSuggestion[] {
  const t = useMessages();
  return isNew ? readyMadeTasks({ ...options, defaultPoints, t }) : [];
}

/**
 * What the name field lists while typing: the household's earlier tasks, then the ready-made ones they haven't
 * added under the same name.
 */
export function withReadyMade(
  earlier: TaskSuggestion[],
  readyMade: TaskSuggestion[],
): TaskSuggestion[] {
  const earlierKeys = new Set(earlier.map((task) => titleKey(task.title)));
  return [...earlier, ...readyMade.filter((task) => !earlierKeys.has(titleKey(task.title)))];
}
