import { z } from 'zod';

import type { Messages } from '@/lib/i18n/i18n';

export const GOAL_TITLE_MAX_LENGTH = 80;
export const MAX_TARGET_POINTS = 10000;

/** Who a goal is for: members chosen to share it (their points count) or one member (only theirs do). */
export const goalScopes = ['shared', 'personal'] as const;

export type GoalScope = (typeof goalScopes)[number];

/** Who takes part in a shared goal, and the points they must earn towards it (null for no minimum). */
export interface NewParticipant {
  userId: string;
  minPoints: number | null;
}

/** Checks a new goal, explaining what to fix in the user's language. */
export function newGoalSchema(t: Messages) {
  const { errors } = t.rewards.form;
  const targetPointsMessage = errors.targetPointsRange(MAX_TARGET_POINTS);
  const minimumMessage = errors.minimumRange;
  return z
    .object({
      /** The reward, e.g. "Pizza night". */
      title: z
        .string()
        .trim()
        .min(1, errors.rewardRequired)
        .max(GOAL_TITLE_MAX_LENGTH, errors.rewardTooLong(GOAL_TITLE_MAX_LENGTH)),
      /** The points that reach the goal. */
      targetPoints: z.coerce
        .number()
        .int(targetPointsMessage)
        .min(1, targetPointsMessage)
        .max(MAX_TARGET_POINTS, targetPointsMessage),
      scope: z.enum(goalScopes),
      /** Whose personal goal it is (an adult can set one for anyone in the family); null for a shared goal. */
      ownerId: z.string().nullable(),
      /**
       * Who takes part in a shared goal (empty for a personal one), each with the points they must earn
       * before it is reached, e.g. less for a younger child, so one member can't reach it alone.
       */
      participants: z.array(
        z.object({
          userId: z.string(),
          minPoints: z.number(minimumMessage).int(minimumMessage).min(1, minimumMessage).nullable(),
        }),
      ),
    })
    .refine((goal) => goal.scope === 'personal' || goal.participants.length > 0, {
      path: ['participants'],
      message: errors.participantsRequired,
    })
    .superRefine((goal, context) => {
      const minimums = goal.participants.map(({ minPoints }) => minPoints ?? 0);
      const total = minimums.reduce((sum, minimum) => sum + minimum, 0);
      if (total <= goal.targetPoints) return;
      const first = minimums.findIndex((minimum) => minimum > 0);
      context.addIssue({
        code: 'custom',
        path: ['participants', first, 'minPoints'],
        message: errors.minimumsTooHigh,
      });
    });
}

export type NewGoal = z.infer<ReturnType<typeof newGoalSchema>>;

/** A member of the household, as goals name them. */
export interface GoalMember {
  id: string;
  /** Their display name, if they have chosen one. */
  name: string | null;
}

/** A participant of a shared goal, with what they have earned towards it. */
export interface GoalParticipant extends GoalMember {
  points: number;
  /** The points they must earn before the goal is reached; null for none. */
  minPoints: number | null;
}

/** A goal with the points counted towards it so far (`household_goals()`). */
export interface Goal {
  id: string;
  title: string;
  targetPoints: number;
  /** Whose personal goal it is (everyone in the household sees it); null for a shared goal. */
  owner: GoalMember | null;
  /**
   * Points of shared tasks done since the goal was set: by its participants for a shared goal, by its
   * owner for a personal one. Counted up to when the reward was claimed.
   */
  points: number;
  /**
   * Who takes part in a shared goal and is still in the household, in the order they joined; empty for
   * a personal goal.
   */
  participants: GoalParticipant[];
  /** Whether the points reach the target and every participant has earned their minimum. */
  reached: boolean;
  /** When the reward was claimed (ISO timestamp); null while the goal is open. */
  claimedAt: string | null;
}

/** A shared goal is claimed by its participants, a personal goal by its owner. */
export function isClaimableBy(goal: Goal, userId: string): boolean {
  if (goal.owner === null) return goal.participants.some(({ id }) => id === userId);
  return goal.owner.id === userId;
}

/** A member's display name, or "A family member" if they haven't chosen one. */
export function nameOf(member: GoalMember, t: Messages): string {
  return member.name ?? t.rewards.aFamilyMember;
}

/** The participants who have earned less than their minimum. */
export function participantsShortOfMinimum(goal: Goal): GoalParticipant[] {
  return goal.participants.filter(
    ({ points, minPoints }) => minPoints !== null && points < minPoints,
  );
}

/** A member of the household for setting goals: only adults set them, also for a child (ADR 0007). */
export interface GoalSetter extends GoalMember {
  isChild: boolean;
}
