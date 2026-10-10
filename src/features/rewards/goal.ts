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

export const newGoalSchema = z.object({
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
});

export type NewGoal = z.infer<typeof newGoalSchema>;

/** A goal with the points counted towards it so far (`household_goals()`). */
export interface Goal {
  id: string;
  title: string;
  targetPoints: number;
  /** Whose personal goal it is (everyone in the household sees it); null for a family goal. */
  owner: { id: string; name: string | null } | null;
  /**
   * Points of shared tasks done since the goal was set: by anyone for a family goal, by its owner for
   * a personal one. Counted up to when the reward was claimed.
   */
  points: number;
  /** When the reward was claimed (ISO timestamp); null while the goal is open. */
  claimedAt: string | null;
}

export function isReached(goal: Goal): boolean {
  return goal.points >= goal.targetPoints;
}

/** Members claim and delete family goals and their own; someone else's personal goal is theirs. */
export function isManagedBy(goal: Goal, userId: string): boolean {
  return goal.owner === null || goal.owner.id === userId;
}

/** The owner's display name, or "A family member" if they haven't chosen one. */
export function ownerNameOf(owner: NonNullable<Goal['owner']>): string {
  return owner.name ?? 'A family member';
}
