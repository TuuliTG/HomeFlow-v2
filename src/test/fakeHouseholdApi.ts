import type * as householdApi from '@/features/household/api';
import { type Household, UnknownInviteCodeError } from '@/features/household/household';
import { fakeAuthBackend } from '@/test/fakeAuthApi';

/**
 * In-memory stand-in for `@/features/household/api`, installed for every unit test in `setup.ts`.
 * Like the database, it only shows the logged-in user (from `fakeAuthBackend`) their own household.
 */
const households: Household[] = [];
/** User id → household id, in the order members joined. */
const memberships = new Map<string, string>();
let requestsFail = false;
let loadingFails = false;

function addHousehold(name: string): Household {
  const household = {
    id: `household:${name}`,
    name,
    // Valid invite codes, distinct per household: ABCDEFGA, ABCDEFGB, …
    inviteCode: `ABCDEFG${'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.charAt(households.length)}`,
  };
  households.push(household);
  return household;
}

function loggedInUserId(): string {
  const user = fakeAuthBackend.currentUser();
  if (!user) throw new Error('Log in first');
  return user.id;
}

function joinAsLoggedInUser(householdId: string): void {
  const userId = loggedInUserId();
  if (memberships.has(userId)) throw new Error('Already in a household');
  memberships.set(userId, householdId);
}

export const fakeHouseholdBackend = {
  reset() {
    households.length = 0;
    memberships.clear();
    requestsFail = false;
    loadingFails = false;
  },
  /** Puts the user in a household with this name, creating it if needed. */
  addMember(userId: string, householdName: string): Household {
    const household =
      households.find(({ name }) => name === householdName) ?? addHousehold(householdName);
    memberships.set(userId, household.id);
    return household;
  },
  /** Makes creating and joining households fail, like a network error. */
  failRequests() {
    requestsFail = true;
  },
  /** Makes loading the user's household fail, like a network error. */
  failLoading() {
    loadingFails = true;
  },
};

export const fetchOwnHousehold: typeof householdApi.fetchOwnHousehold = () => {
  if (loadingFails) return Promise.reject(new Error('Network error'));
  const householdId = memberships.get(loggedInUserId());
  return Promise.resolve(households.find(({ id }) => id === householdId) ?? null);
};

export const fetchHouseholdMembers: typeof householdApi.fetchHouseholdMembers = (householdId) =>
  Promise.resolve(
    [...memberships]
      // Like Row Level Security: only the logged-in user's own household shows its members.
      .filter(
        ([, memberOf]) =>
          memberOf === householdId && memberships.get(loggedInUserId()) === householdId,
      )
      .map(([userId]) => ({ userId, displayName: fakeAuthBackend.displayNameOf(userId) })),
  );

export const createHousehold: typeof householdApi.createHousehold = (name) => {
  if (requestsFail) return Promise.reject(new Error('Network error'));
  const household = addHousehold(name);
  joinAsLoggedInUser(household.id);
  return Promise.resolve(household);
};

export const joinHousehold: typeof householdApi.joinHousehold = (inviteCode) => {
  if (requestsFail) return Promise.reject(new Error('Network error'));
  const household = households.find((candidate) => candidate.inviteCode === inviteCode);
  if (!household) return Promise.reject(new UnknownInviteCodeError());
  joinAsLoggedInUser(household.id);
  return Promise.resolve();
};
