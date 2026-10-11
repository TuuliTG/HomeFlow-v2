import { z } from 'zod';

import type { Messages } from '@/lib/i18n/i18n';

export const GOAL_TITLE_MAX_LENGTH = 80;
export const MAX_TARGET_POINTS = 10000;

/** Who a goal is for: the whole family (everyone's points count) or one member (only theirs do). */
export const goalScopes = ['shared', 'personal'] as const;

export type GoalScope = (typeof goalScopes)[number];

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
      /** Whose personal goal it is (an adult can set one for anyone in the family); null for a family goal. */
      ownerId: z.string().nullable(),
      /**
       * For a family goal, the points each member must earn towards it before it is reached, so one
       * member can't reach it alone; null for none (and always for a personal goal).
       */
      minPointsPerMember: z
        .number(minimumMessage)
        .int(minimumMessage)
        .min(1, minimumMessage)
        .nullable(),
    })
    .refine((goal) => goal.minPointsPerMember === null || goal.scope === 'shared', {
      path: ['minPointsPerMember'],
      message: errors.minimumOnlyForFamily,
    })
    .refine(
      (goal) => goal.minPointsPerMember === null || goal.minPointsPerMember <= goal.targetPoints,
      { path: ['minPointsPerMember'], message: minimumMessage },
    );
}

export type NewGoal = z.infer<ReturnType<typeof newGoalSchema>>;

/** A member of the household, as goals name them. */
export interface GoalMember {
  id: string;
  /** Their display name, if they have chosen one. */
  name: string | null;
}

/** A goal with the points counted towards it so far (`household_goals()`). */
export interface Goal {
  id: string;
  title: string;
  targetPoints: number;
  /** Whose personal goal it is (everyone in the household sees it); null for a family goal. */
  owner: GoalMember | null;
  /** The points each member must earn towards a family goal before it is reached; null for none. */
  minPointsPerMember: number | null;
  /**
   * Points of shared tasks done since the goal was set: by anyone for a family goal, by its owner for
   * a personal one. Counted up to when the reward was claimed.
   */
  points: number;
  /**
   * What each current member has earned towards a family goal, in the order they joined; empty for a
   * personal goal.
   */
  memberPoints: (GoalMember & { points: number })[];
  /** Whether the points reach the target and every member has earned the minimum, if there is one. */
  reached: boolean;
  /** When the reward was claimed (ISO timestamp); null while the goal is open. */
  claimedAt: string | null;
}

/** Members claim family goals and their own; someone else's personal goal is theirs to claim. */
export function isClaimableBy(goal: Goal, userId: string): boolean {
  return goal.owner === null || goal.owner.id === userId;
}

/** A member's display name, or "A family member" if they haven't chosen one. */
export function nameOf(member: GoalMember, t: Messages): string {
  return member.name ?? t.rewards.aFamilyMember;
}

/** The members who have earned less than a family goal's minimum, with how many points they still need. */
export function membersShortOfMinimum(goal: Goal): (GoalMember & { pointsNeeded: number })[] {
  const minimum = goal.minPointsPerMember;
  if (minimum === null) return [];
  return goal.memberPoints.flatMap(({ points, ...member }) =>
    points < minimum ? [{ ...member, pointsNeeded: minimum - points }] : [],
  );
}

/** A member of the household for setting goals: only adults set them, also for a child (ADR 0007). */
export interface GoalSetter extends GoalMember {
  isChild: boolean;
}
