import type * as goalsApi from '@/features/rewards/api';
import type { Goal } from '@/features/rewards/goal';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { requestsFailing, tasks } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/rewards/api`, installed for every unit test in `setup.ts`. Like
 * `household_goals()`, it counts the points of shared tasks in `fakeTasksBackend` done since a goal was
 * set, and shows the logged-in user their household's family goals and their own personal ones.
 */
interface StoredGoal {
  id: string;
  householdId: string;
  title: string;
  targetPoints: number;
  /** Null for a family goal. */
  ownerId: string | null;
  /** ISO timestamps. */
  createdAt: string;
  claimedAt: string | null;
}

const goals: StoredGoal[] = [];

function pointsOf(goal: StoredGoal): number {
  return tasks
    .filter(
      ({ householdId, isPrivate, completed }) =>
        householdId === goal.householdId &&
        !isPrivate &&
        completed !== null &&
        completed.at >= goal.createdAt &&
        (goal.claimedAt === null || completed.at <= goal.claimedAt) &&
        (goal.ownerId === null || completed.by === goal.ownerId),
    )
    .reduce((total, task) => total + (task.points ?? 0), 0);
}

function loggedInUserId(): string {
  const user = fakeAuthBackend.currentUser();
  if (requestsFailing() || !user) throw new Error('Network error');
  return user.id;
}

/** The goals the logged-in user can see, like the select policy on `goals`. */
function visibleGoals(): StoredGoal[] {
  const userId = loggedInUserId();
  const householdId = fakeHouseholdBackend.householdIdOf(userId);
  return goals.filter(
    (goal) =>
      goal.householdId === householdId && (goal.ownerId === null || goal.ownerId === userId),
  );
}

function openGoal(goalId: string): StoredGoal {
  const goal = visibleGoals().find(({ id, claimedAt }) => id === goalId && claimedAt === null);
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
        scope: goal.ownerId === null ? 'shared' : 'personal',
        points: pointsOf(goal),
        claimedAt: goal.claimedAt,
      }));
  });

export const addGoal: typeof goalsApi.addGoal = ({ title, targetPoints, scope }, userId) =>
  request(() => {
    if (userId !== loggedInUserId()) throw new Error('Nobody sets a goal for someone else');
    fakeGoalsBackend.addGoalAs(userId, { title, targetPoints, isShared: scope === 'shared' });
  });

export const deleteGoal: typeof goalsApi.deleteGoal = (goalId) =>
  request(() => {
    goals.splice(goals.indexOf(openGoal(goalId)), 1);
  });

export const claimGoalReward: typeof goalsApi.claimGoalReward = (goalId) =>
  request(() => {
    const goal = openGoal(goalId);
    if (pointsOf(goal) < goal.targetPoints) throw new Error('This goal has not been reached yet');
    goal.claimedAt = new Date().toISOString();
  });

export const fakeGoalsBackend = {
  reset() {
    goals.length = 0;
  },
  /** Stores a goal as if `userId` had set it: a family goal, or their own. */
  addGoalAs(
    userId: string,
    goal: { title: string; targetPoints: number; isShared: boolean },
  ): void {
    const householdId = fakeHouseholdBackend.householdIdOf(userId);
    if (!householdId) throw new Error(`${userId} is not in a household`);
    goals.push({
      id: `goal:${String(goals.length)}`,
      householdId,
      title: goal.title,
      targetPoints: goal.targetPoints,
      ownerId: goal.isShared ? null : userId,
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
