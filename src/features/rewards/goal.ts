import { z } from 'zod';

export const GOAL_TITLE_MAX_LENGTH = 80;
export const MAX_TARGET_POINTS = 10000;

/** Who a goal is for: the whole family (everyone's points count) or just the user (only theirs do). */
export const goalScopes = ['shared', 'personal'] as const;

export type GoalScope = (typeof goalScopes)[number];

export const goalScopeLabels: Record<GoalScope, string> = {
  shared: 'The family',
  personal: 'Just me',
};

const targetPointsMessage = `Points needed must be a whole number from 1 to ${String(MAX_TARGET_POINTS)}.`;
const minimumMessage =
  'The minimum from each member must be a whole number from 1 to the points needed.';

export const newGoalSchema = z
  .object({
    /** The reward, e.g. "Pizza night". */
    title: z
      .string()
      .trim()
      .min(1, 'Name the reward.')
      .max(
        GOAL_TITLE_MAX_LENGTH,
        `Keep the reward to ${String(GOAL_TITLE_MAX_LENGTH)} characters or fewer.`,
      ),
    /** The points that reach the goal. */
    targetPoints: z.coerce
      .number()
      .int(targetPointsMessage)
      .min(1, targetPointsMessage)
      .max(MAX_TARGET_POINTS, targetPointsMessage),
    scope: z.enum(goalScopes),
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
    message: 'Only family goals ask for a minimum from each member.',
  })
  .refine(
    (goal) => goal.minPointsPerMember === null || goal.minPointsPerMember <= goal.targetPoints,
    { path: ['minPointsPerMember'], message: minimumMessage },
  );

export type NewGoal = z.infer<typeof newGoalSchema>;

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

/** Members claim and delete family goals and their own; someone else's personal goal is theirs. */
export function isManagedBy(goal: Goal, userId: string): boolean {
  return goal.owner === null || goal.owner.id === userId;
}

/** A member's display name, or "A family member" if they haven't chosen one. */
export function nameOf(member: GoalMember): string {
  return member.name ?? 'A family member';
}

/** The members who have earned less than a family goal's minimum, with how many points they still need. */
export function membersShortOfMinimum(goal: Goal): (GoalMember & { pointsNeeded: number })[] {
  const minimum = goal.minPointsPerMember;
  if (minimum === null) return [];
  return goal.memberPoints.flatMap(({ points, ...member }) =>
    points < minimum ? [{ ...member, pointsNeeded: minimum - points }] : [],
  );
}
