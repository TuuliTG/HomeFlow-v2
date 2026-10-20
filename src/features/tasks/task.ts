import { z } from 'zod';

import type { Messages } from '@/lib/i18n/i18n';

export const taskTypes = ['physical', 'meta'] as const;

export type TaskType = (typeof taskTypes)[number];

/**
 * The icons a task can show to make clear what it is about, e.g. for children who don't read yet. The
 * database stores the name and checks only its format (ADR 0004), so the set can grow without a migration.
 */
export const taskIconNames = [
  'bed',
  'dishes',
  'laundry',
  'vacuum',
  'cleaning',
  'trash',
  'recycling',
  'plants',
  'pet',
  'toys',
  'table',
  'cooking',
  'shopping',
  'car',
  'homework',
  'calendar',
  'phone',
  'bills',
] as const;

export type TaskIconName = (typeof taskIconNames)[number];

export const TITLE_MAX_LENGTH = 80;

export const DESCRIPTION_MAX_LENGTH = 500;

/**
 * A task's name as `task_suggestions()` groups tasks and `favourite_tasks` stores them: ignoring case and
 * spaces around it.
 */
export function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

/** The points a shared task can earn, and what a new one starts with. */
export const MIN_POINTS = 1;
export const MAX_POINTS = 10;
export const DEFAULT_POINTS = 3;

/** How many pictures a task can show; `set_task_images()` enforces it. */
export const MAX_TASK_IMAGES = 3;

/** How long the address a task picture is shown from works, in seconds. */
export const IMAGE_URL_LIFETIME_SECONDS = 60 * 60;

/** How many recently done tasks the board shows with "Show completed". */
export const HOUSEHOLD_COMPLETED_LIMIT = 30;

/** How long after marking a task done the user can undo it; `undo_complete_task()` enforces it. */
export const UNDO_WINDOW_MS = 60 * 60 * 1000;

/**
 * How long after marking a task done the user can say who helped; `set_task_helpers()` enforces it.
 * As long as the task is in the News.
 */
export const HELPERS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** How often a task can repeat, in days; offered as choices when creating a task. */
export const repeatChoices = [1, 2, 3, 7, 14, 30] as const;

/** Checks a task's details, explaining what to fix in the user's language. */
export const newTaskSchema = ({ taskForm: { errors } }: Messages) =>
  z
    .object({
      title: z
        .string()
        .trim()
        .min(1, errors.titleRequired)
        .max(TITLE_MAX_LENGTH, errors.titleTooLong(TITLE_MAX_LENGTH)),
      /** More detail when the title isn't enough; null when there is none. */
      description: z
        .string()
        .trim()
        .min(1)
        .max(DESCRIPTION_MAX_LENGTH, errors.descriptionTooLong(DESCRIPTION_MAX_LENGTH))
        .nullable(),
      type: z.enum(taskTypes),
      /**
       * Null for a private task, which earns none, and for a child's shared task until an adult awards
       * its points.
       */
      points: z.coerce
        .number()
        .int(errors.pointsRange)
        .min(MIN_POINTS, errors.pointsRange)
        .max(MAX_POINTS, errors.pointsRange)
        .nullable(),
      /** Days after it is done that the task comes back; null for a one-off task. */
      repeatEveryDays: z.number().int().min(1).max(365).nullable(),
      /** Local date (YYYY-MM-DD) the task should be done by, if any. */
      dueOn: z.iso.date(errors.invalidDueDate).nullable(),
      /**
       * Seen only by whoever added it, not shared with the family. Chosen when adding the task. Private
       * tasks have no points and don't count in statistics.
       */
      isPrivate: z.boolean(),
      /**
       * Whether children in the household see it and can do it; adults see every task. A child's own
       * tasks are always for children.
       */
      forChildren: z.boolean(),
      /** What the task's tile shows instead of its type's icon; null for none. */
      icon: z.enum(taskIconNames).nullable(),
    })
    .refine((task) => !task.isPrivate || task.points === null, {
      path: ['points'],
      message: errors.onlySharedHavePoints,
    });

export type NewTask = z.infer<ReturnType<typeof newTaskSchema>>;

/** What a new task starts with besides its name, description and due date. */
export const NEW_TASK_DEFAULTS = {
  type: 'physical',
  points: DEFAULT_POINTS,
  repeatEveryDays: null,
  isPrivate: false,
  forChildren: false,
  icon: null,
} as const satisfies Partial<NewTask>;

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
  /** Its pictures in order, by their file names in the task-images bucket (`task_images`). */
  images: string[];
  /**
   * Who marked the previous occurrence of a repeating task done, and when; null for the first
   * occurrence and for private tasks.
   */
  lastDone: LastDone | null;
  /** A member's request that another do it (`task_requests`), if any. */
  request: TaskRequest | null;
}

/**
 * One member asking another to do a task. Accepting picks the task up for them; a request goes once the
 * task is done or someone else picks it up.
 */
export interface TaskRequest {
  requestedBy: string;
  /** Their display name, if they have chosen one. */
  requesterName: string | null;
  requestedFor: string;
  /** Their display name, if they have chosen one. */
  askedName: string | null;
  /** Null while waiting for an answer. */
  answer: 'accepted' | 'declined' | null;
}

/**
 * Whether the user can ask someone to do the task: an open shared task that is free or theirs, which
 * they can hand over this way (`request_task()`).
 */
export function canRequest(task: Task, userId: string): boolean {
  return !task.isPrivate && (task.pickedUpBy === null || task.pickedUpBy === userId);
}

/**
 * The other members the user could ask to do the task: everyone else for a task for children, only
 * adults for the others (`request_task()`).
 */
export function membersToAsk<M extends { id: string; isChild: boolean }>(
  task: Task,
  members: M[],
  userId: string,
): M[] {
  return members.filter((member) => member.id !== userId && (task.forChildren || !member.isChild));
}

export interface LastDone {
  /** User id; null if they have deleted their account. */
  by: string | null;
  /** Their display name, if they have chosen one. */
  name: string | null;
  /** ISO timestamp. */
  at: string;
}

/**
 * Whether the open task is the user's to do: one they picked up, or a private task (only its creator
 * sees those). They list it in My tasks and can set a reminder for it.
 */
export function isToDoBy(task: Task, userId: string): boolean {
  return task.isPrivate || task.pickedUpBy === userId;
}

/** Whether the user may edit or delete the task: adults any, a child only one they added (`private.can_change_task()`). */
export function canChange(task: Task, userId: string, isChild: boolean): boolean {
  return !isChild || task.createdBy === userId;
}

/** A task the household has added before, to add again with the same details (`task_suggestions()`). */
export interface TaskSuggestion extends Omit<NewTask, 'dueOn'> {
  /** How many times members have added it; repeats a task adds itself don't count. */
  timesAdded: number;
  /** Whether it is on the board now, not yet done. */
  isOpen: boolean;
}

/** Someone who helped with a task, and their share of its points (`task_helpers`). */
export interface TaskHelper {
  userId: string;
  /** Their display name, if they have chosen one. */
  name: string | null;
  points: number;
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
  /** Who helped; their shares come out of the task's points. */
  helpers: TaskHelper[];
}

/** The points the task earned whoever marked it done: what the helpers didn't get. */
export function doersShare({ points, helpers }: CompletedTask): number | null {
  if (points === null) return null;
  return helpers.reduce((rest, helper) => rest - helper.points, points);
}

/**
 * Whether whoever marked the task done can still say who helped: a shared task with points, done in
 * the last week (`set_task_helpers()` has the final say).
 */
export function canChooseHelpers(task: CompletedTask, now: number): boolean {
  return task.points !== null && now - new Date(task.completedAt).getTime() < HELPERS_WINDOW_MS;
}

/** A task the user helped someone else with (`own_helped_tasks()`), maybe one they can't otherwise see. */
export interface HelpedTask {
  id: string;
  title: string;
  type: TaskType;
  /** The user's share of its points. */
  points: number;
  /** When it was marked done (ISO timestamp). */
  completedAt: string;
  /** The display name of whoever marked it done, if they have chosen one. */
  doerName: string | null;
}

/** Whether to ask who helped right after marking the task done: only a shared task with points can be shared. */
export function canAskWhoHelped(task: Pick<Task, 'points' | 'isPrivate'>): boolean {
  return task.points !== null && !task.isPrivate;
}

/** A task someone in the household has marked done. */
export interface HouseholdCompletedTask extends CompletedTask {
  completedBy: string | null;
  /** Their display name, if they have chosen one. */
  completerName: string | null;
}

/** When the user wants to be reminded of a task that is theirs to do (`set_task_reminder()`). */
export interface TaskReminder {
  taskId: string;
  /** ISO timestamp. */
  remindAt: string;
}
