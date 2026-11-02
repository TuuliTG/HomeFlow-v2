import { z } from 'zod';

/**
 * The icons a task can show to make clear what it is about, e.g. for children who don't read yet, each an
 * emoji (`TaskIcon`). The database stores the name and checks only its format (ADR 0004), so the set can
 * grow without a migration.
 */
export const taskIconNames = [
  'bed',
  'clothes',
  'laundry',
  'dishes',
  'table',
  'cooking',
  'vacuum',
  'cleaning',
  'bath',
  'toilet',
  'window',
  'trash',
  'recycling',
  'toys',
  'shoes',
  'plants',
  'garden',
  'leaves',
  'snow',
  'pet',
  'dog',
  'cat',
  'shopping',
  'groceries',
  'car',
  'tools',
  'baby',
  'medicine',
  'homework',
  'school',
  'reading',
  'music',
  'sport',
  'gift',
  'mail',
  'calendar',
  'phone',
  'bills',
] as const;

export type TaskIconName = (typeof taskIconNames)[number];

/** A task's icon; one this version of the app doesn't know, e.g. added by a newer one, shows as none. */
export const taskIconSchema = z.enum(taskIconNames).nullable().catch(null);
