import type * as goalsApi from '@/features/rewards/api';
import type { Goal, NewParticipant } from '@/features/rewards/goal';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { creditsOf, requestsFailing, tasks } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/rewards/api`, installed for every unit test in `setup.ts`. Like
 * `household_goals()`, it counts the points of shared tasks in `fakeTasksBackend` done since a goal was
 * set, helpers' shares included, and decides whether a goal is reached like `goal_is_reached()`. Like
 * its policies, members see all their household's goals and claim the shared goals they take part in
 * and their own, and only adults add, change and delete goals.
 */
interface StoredGoal {
  id: string;
  householdId: string;
  title: string;
  targetPoints: number;
  /** Null for a shared goal. */
  ownerId: string | null;
  /** Who takes part in a shared goal; empty for a personal one. */
  participants: NewParticipant[];
  /** ISO timestamps. */
  createdAt: string;
  claimedAt: string | null;
}

const goals: StoredGoal[] = [];

/** Points from shared tasks done towards the goal, earned by `doneBy` (its participants when null). */
function pointsOf(goal: StoredGoal, doneBy = goal.ownerId): number {
  const countsFor = (userId: string) =>
    doneBy === null ? goal.participants.some((p) => p.userId === userId) : userId === doneBy;
  return tasks
    .filter(
      ({ householdId, completed }) =>
        householdId === goal.householdId &&
        completed !== null &&
        completed.at >= goal.createdAt &&
        (goal.claimedAt === null || completed.at <= goal.claimedAt),
    )
    .flatMap(creditsOf)
    .filter((credit) => countsFor(credit.userId))
    .reduce((total, credit) => total + credit.points, 0);
}

/** What each participant has earned towards a shared goal, in the order they joined. */
function participantPointsOf(goal: StoredGoal): Goal['participants'] {
  return fakeHouseholdBackend.memberIdsOf(goal.householdId).flatMap((id) => {
    const participant = goal.participants.find(({ userId }) => userId === id);
    if (!participant) return [];
    const name = fakeAuthBackend.displayNameOf(id);
    return [{ id, name, points: pointsOf(goal, id), minPoints: participant.minPoints }];
  });
}

function isReached(goal: StoredGoal): boolean {
  return (
    pointsOf(goal) >= goal.targetPoints &&
    participantPointsOf(goal).every(
      ({ points, minPoints }) => minPoints === null || points >= minPoints,
    )
  );
}

function loggedInUserId(): string {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || !user) throw new Error('Network error');
  return user.id;
}

/** The goals the logged-in user can see, like the select policy on `goals`. */
function visibleGoals(): StoredGoal[] {
  const householdId = fakeHouseholdBackend.householdIdOf(loggedInUserId());
  return goals.filter((goal) => goal.householdId === householdId);
}

/** An open shared goal the user takes part in or one of their own, which they can claim. */
function openGoal(goalId: string): StoredGoal {
  const userId = loggedInUserId();
  const goal = visibleGoals().find(
    ({ id, claimedAt, ownerId, participants }) =>
      id === goalId &&
      claimedAt === null &&
      (ownerId === userId || participants.some((p) => p.userId === userId)),
  );
  if (!goal) throw new Error(`No open goal ${goalId}`);
  return goal;
}

/** Answers like a request: what `respond` throws becomes a rejection. */
function request<T>(respond: () => T): Promise<T> {
  return Promise.resolve().then(respond);
}

export const fetchGoals: typeof goalsApi.fetchGoals = () =>
  request(() => {
    const byNewest = (a: string, b: string) => b.localeCompare(a);
    return visibleGoals()
      .sort(
        (a, b) =>
          Number(a.claimedAt !== null) - Number(b.claimedAt !== null) ||
          byNewest(a.claimedAt ?? '', b.claimedAt ?? '') ||
          byNewest(a.createdAt, b.createdAt),
      )
      .map((goal): Goal => ({
        id: goal.id,
        title: goal.title,
        targetPoints: goal.targetPoints,
        owner:
          goal.ownerId === null
            ? null
            : { id: goal.ownerId, name: fakeAuthBackend.displayNameOf(goal.ownerId) },
        points: pointsOf(goal),
        participants: participantPointsOf(goal),
        reached: isReached(goal),
        claimedAt: goal.claimedAt,
      }));
  });

/** Like the insert policy and `add_shared_goal()`: an adult, for members of their household. */
export const addGoal: typeof goalsApi.addGoal = ({ title, targetPoints, ownerId, participants }) =>
  request(() => {
    const userId = loggedInUserId();
    const householdId = fakeHouseholdBackend.householdIdOf(userId);
    if (fakeHouseholdBackend.isChild(userId)) throw new Error('Only adults set goals');
    const forMembers = ownerId === null ? participants.map((p) => p.userId) : [ownerId];
    if (forMembers.some((id) => fakeHouseholdBackend.householdIdOf(id) !== householdId)) {
      throw new Error('A goal is for members of the household');
    }
    fakeGoalsBackend.addGoalAs(userId, {
      title,
      targetPoints,
      isShared: ownerId === null,
      participants,
    });
    const added = goals.at(-1);
    if (added && ownerId !== null) added.ownerId = ownerId;
  });

/** Like `update_goal()`: an adult, an open goal in their household, for members of it. */
export const updateGoal: typeof goalsApi.updateGoal = (
  goalId,
  { title, targetPoints, ownerId, participants },
) =>
  request(() => {
    const userId = loggedInUserId();
    const householdId = fakeHouseholdBackend.householdIdOf(userId);
    if (fakeHouseholdBackend.isChild(userId)) throw new Error('Only adults change goals');
    const goal = visibleGoals().find(({ id, claimedAt }) => id === goalId && claimedAt === null);
    if (!goal) throw new Error(`No open goal ${goalId}`);
    const forMembers = ownerId === null ? participants.map((p) => p.userId) : [ownerId];
    if (forMembers.some((id) => fakeHouseholdBackend.householdIdOf(id) !== householdId)) {
      throw new Error('A goal is for members of the household');
    }
    Object.assign(goal, {
      title,
      targetPoints,
      ownerId,
      participants: ownerId === null ? participants : [],
    });
  });

/** Like the delete policy: an adult, any open goal in their household. */
export const deleteGoal: typeof goalsApi.deleteGoal = (goalId) =>
  request(() => {
    if (fakeHouseholdBackend.isChild(loggedInUserId())) throw new Error('Only adults delete goals');
    const goal = visibleGoals().find(({ id, claimedAt }) => id === goalId && claimedAt === null);
    if (!goal) throw new Error(`No open goal ${goalId}`);
    goals.splice(goals.indexOf(goal), 1);
  });

export const fetchGoalSetters: typeof goalsApi.fetchGoalSetters = () =>
  request(() => {
    const householdId = fakeHouseholdBackend.householdIdOf(loggedInUserId());
    if (!householdId) return [];
    return fakeHouseholdBackend.memberIdsOf(householdId).map((id) => ({
      id,
      name: fakeAuthBackend.displayNameOf(id),
      isChild: fakeHouseholdBackend.isChild(id),
    }));
  });

export const claimGoalReward: typeof goalsApi.claimGoalReward = (goalId) =>
  request(() => {
    const goal = openGoal(goalId);
    if (!isReached(goal)) throw new Error('This goal has not been reached yet');
    goal.claimedAt = new Date().toISOString();
  });

export const fakeGoalsBackend = {
  reset() {
    goals.length = 0;
  },
  /**
   * Stores a goal as if `userId` had set it: their own, or a shared goal for `participants` (by default
   * everyone in the household, without minimums).
   */
  addGoalAs(
    userId: string,
    goal: {
      title: string;
      targetPoints: number;
      isShared: boolean;
      participants?: NewParticipant[];
    },
  ): void {
    const householdId = fakeHouseholdBackend.householdIdOf(userId);
    if (!householdId) throw new Error(`${userId} is not in a household`);
    goals.push({
      id: `goal:${String(goals.length)}`,
      householdId,
      title: goal.title,
      targetPoints: goal.targetPoints,
      ownerId: goal.isShared ? null : userId,
      participants: !goal.isShared
        ? []
        : (goal.participants ??
          fakeHouseholdBackend
            .memberIdsOf(householdId)
            .map((id) => ({ userId: id, minPoints: null }))),
      createdAt: new Date().toISOString(),
      claimedAt: null,
    });
  },
  /** Claims a goal's reward as if another member had, e.g. just before the user tries to. */
  claimAs(goalId: string): void {
    const goal = goals.find(({ id }) => id === goalId);
    if (goal) goal.claimedAt = new Date().toISOString();
  },
};
