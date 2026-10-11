import type * as householdApi from '@/features/household/api';
import { type Household, UnknownInviteCodeError } from '@/features/household/household';
import type { AuthUser } from '@/lib/auth';
import { fakeAuthBackend } from '@/test/fakeAuthApi';

/**
 * In-memory stand-in for `@/features/household/api`, installed for every unit test in `setup.ts`.
 * Like the database, it only shows the logged-in user (from `fakeAuthBackend`) their own household.
 */
/** Households as stored, each with its invite code (members get it only from `fetchOwnHousehold`). */
type StoredHousehold = Household & { inviteCode: string };
const households: StoredHousehold[] = [];
/** User id → household id, in the order members joined. */
const memberships = new Map<string, string>();
/** Members an adult has marked as children. */
const children = new Set<string>();
/** Children an adult lets add tasks. */
const childrenAddingTasks = new Set<string>();
/** Children an adult added without email, who sign in with codes. */
const childAccounts = new Set<string>();
let codesMade = 0;
let requestsFail = false;
let loadingFails = false;

function addHousehold(name: string): StoredHousehold {
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
    children.clear();
    childAccounts.clear();
    childrenAddingTasks.clear();
    codesMade = 0;
    requestsFail = false;
    loadingFails = false;
  },
  /** Puts the user in a household with this name, creating it if needed. */
  addMember(userId: string, householdName: string): StoredHousehold {
    const household =
      households.find(({ name }) => name === householdName) ?? addHousehold(householdName);
    memberships.set(userId, household.id);
    return household;
  },
  householdIdOf: (userId: string) => memberships.get(userId) ?? null,
  /** Marks the member as a child or an adult, like `set_member_is_child()` without its checks. */
  setChild(userId: string, isChild: boolean) {
    if (isChild) children.add(userId);
    else children.delete(userId);
  },
  isChild: (userId: string) => children.has(userId),
  /** Lets a child add tasks or stops them, like `set_member_can_add_tasks()` without its checks. */
  setCanAddTasks(userId: string, canAdd: boolean) {
    if (canAdd) childrenAddingTasks.add(userId);
    else childrenAddingTasks.delete(userId);
  },
  /** Adults always; children when an adult lets them. */
  canAddTasks: (userId: string) => !children.has(userId) || childrenAddingTasks.has(userId),
  /** The household's members' user ids, in the order they joined. */
  memberIdsOf: (householdId: string) =>
    [...memberships].flatMap(([userId, memberOf]) => (memberOf === householdId ? [userId] : [])),
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
  const userId = loggedInUserId();
  const household = households.find(({ id }) => id === memberships.get(userId));
  // Like household_invite_code(): children don't get it.
  return Promise.resolve(
    household
      ? { ...household, inviteCode: children.has(userId) ? null : household.inviteCode }
      : null,
  );
};

/** A new code for the child, like `issue_child_sign_in_code()`: KX7PAAAA, KX7PAAAB, … */
function issueCode(child: AuthUser) {
  const code = `KX7PAAA${'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.charAt(codesMade)}`;
  codesMade += 1;
  fakeAuthBackend.setChildCode(child, code);
  return { code, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
}

/** Whether the logged-in user is an adult in a household, like `private.adult_household_id()`. */
function adultHouseholdId(): string | undefined {
  const userId = loggedInUserId();
  return children.has(userId) ? undefined : memberships.get(userId);
}

/** Like the add-child Edge Function: a child without email, in the adult's household. */
export const addChild: typeof householdApi.addChild = (displayName) => {
  const householdId = adultHouseholdId();
  if (requestsFail || !householdId) return Promise.reject(new Error('Not added'));
  const child = fakeAuthBackend.addProfile(
    `${displayName.toLowerCase()}@child.homeflow.invalid`,
    displayName,
  );
  memberships.set(child.id, householdId);
  children.add(child.id);
  childAccounts.add(child.id);
  return Promise.resolve(issueCode(child));
};

/** Like `set_member_can_add_tasks()`: an adult, for a child in their household. */
export const setMemberCanAddTasks: typeof householdApi.setMemberCanAddTasks = (
  memberId,
  canAdd,
) => {
  const householdId = adultHouseholdId();
  if (requestsFail || !householdId) return Promise.reject(new Error('Not allowed'));
  if (!children.has(memberId) || memberships.get(memberId) !== householdId) {
    return Promise.reject(new Error('No such child'));
  }
  fakeHouseholdBackend.setCanAddTasks(memberId, canAdd);
  return Promise.resolve();
};

export const newChildSignInCode: typeof householdApi.newChildSignInCode = (childId) => {
  const householdId = adultHouseholdId();
  if (requestsFail || !householdId) return Promise.reject(new Error('Not allowed'));
  if (!childAccounts.has(childId) || memberships.get(childId) !== householdId) {
    return Promise.reject(new Error('No such child'));
  }
  return Promise.resolve(issueCode({ id: childId, email: '' }));
};

export const fetchHouseholdMembers: typeof householdApi.fetchHouseholdMembers = (householdId) =>
  Promise.resolve(
    [...memberships]
      // Like Row Level Security: only the logged-in user's own household shows its members.
      .filter(
        ([, memberOf]) =>
          memberOf === householdId && memberships.get(loggedInUserId()) === householdId,
      )
      .map(([userId]) => ({
        userId,
        displayName: fakeAuthBackend.displayNameOf(userId),
        isChild: children.has(userId),
        signsInWithCode: childAccounts.has(userId),
        canAddTasks: fakeHouseholdBackend.canAddTasks(userId),
      })),
  );

/** Like `set_member_is_child()`: only an adult, for another member of their household. */
export const setMemberIsChild: typeof householdApi.setMemberIsChild = (memberId, isChild) => {
  const userId = loggedInUserId();
  if (requestsFail) return Promise.reject(new Error('Network error'));
  if (children.has(userId) || memberId === userId) return Promise.reject(new Error('Not allowed'));
  if (memberships.get(memberId) !== memberships.get(userId))
    return Promise.reject(new Error('Not in your household'));
  fakeHouseholdBackend.setChild(memberId, isChild);
  return Promise.resolve();
};

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
