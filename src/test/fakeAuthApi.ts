import type * as authApi from '@/features/auth/api';
import type { Profile } from '@/features/auth/api';
import { LoginError } from '@/features/auth/loginError';
import type { AuthUser } from '@/lib/auth';

// In-memory stand-in for `@/features/auth/api`, installed for every unit test in `setup.ts`.
// The "backend" lives in module state, so it survives unmounting the app like a real session.

/** Password of every account created with `logInAs` or `addAccount`. */
export const FAKE_PASSWORD = 'correct horse';

let currentUser: AuthUser | null = null;
/** Email → password of every account. */
const passwords = new Map<string, string>();
let requestsFail = false;
let loadingProfilesFails = false;
const profiles = new Map<string, Profile>();
const listeners = new Set<(user: AuthUser | null) => void>();
/** One-time sign-in codes of children without email → the child. */
const childCodes = new Map<string, AuthUser>();
/** Accounts whose sessions ended elsewhere, so their kept tokens no longer sign in. */
const endedSessions = new Set<string>();

/** User ids in fake tokens are the user's email after `user:`, so tokens lead back to the user. */
function userWithId(userId: string): AuthUser {
  return userFor(userId.replace(/^user:/, ''));
}

function userFor(email: string): AuthUser {
  return { id: `user:${email}`, email };
}

function setCurrentUser(user: AuthUser | null) {
  currentUser = user;
  listeners.forEach((listener) => {
    listener(user);
  });
}

export const fakeAuthBackend = {
  reset() {
    currentUser = null;
    requestsFail = false;
    passwords.clear();
    loadingProfilesFails = false;
    profiles.clear();
    listeners.clear();
    childCodes.clear();
    endedSessions.clear();
  },
  /** Ends the user's sessions, as if they logged out everywhere: tokens kept for them stop working. */
  endSessions(userId: string) {
    endedSessions.add(userId);
  },
  /** Whether tokens kept for the user still sign in. */
  hasSession: (userId: string) => !endedSessions.has(userId),
  /** Lets `code` sign in the child once (like `take_child_sign_in_code()`), replacing their earlier code. */
  setChildCode(child: AuthUser, code: string) {
    for (const [earlier, user] of childCodes) if (user.id === child.id) childCodes.delete(earlier);
    childCodes.set(code, child);
  },
  /** Starts the next render already logged in, optionally with a saved profile. */
  logInAs(email: string, displayName?: string): AuthUser {
    const user = fakeAuthBackend.addAccount(email, displayName);
    currentUser = user;
    return user;
  },
  /** Creates an account (password `FAKE_PASSWORD`) without logging in, optionally with a profile. */
  addAccount(email: string, displayName?: string): AuthUser {
    const user = userFor(email);
    passwords.set(email, FAKE_PASSWORD);
    if (displayName) profiles.set(user.id, { displayName });
    return user;
  },
  /** Saves a profile for someone other than the logged-in user, e.g. a family member. */
  addProfile(email: string, displayName: string): AuthUser {
    const user = userFor(email);
    profiles.set(user.id, { displayName });
    return user;
  },
  currentUser: () => currentUser,
  displayNameOf: (userId: string) => profiles.get(userId)?.displayName ?? null,
  /** Makes logging in and creating accounts fail, like a network error. */
  failRequests() {
    requestsFail = true;
  },
  failLoadingProfiles() {
    loadingProfilesFails = true;
  },
};

export const logIn: typeof authApi.logIn = (email, password) => {
  if (requestsFail) return Promise.reject(new Error('Network error'));
  if (passwords.get(email) !== password) {
    return Promise.reject(new LoginError('wrong-credentials', 'Invalid login credentials'));
  }
  setCurrentUser(userFor(email));
  return Promise.resolve();
};

export const createAccount: typeof authApi.createAccount = (email, password) => {
  if (requestsFail) return Promise.reject(new Error('Network error'));
  if (passwords.has(email)) {
    return Promise.reject(new LoginError('account-exists', 'User already registered'));
  }
  passwords.set(email, password);
  setCurrentUser(userFor(email));
  return Promise.resolve();
};

/** Takes a child's one-time code, like the `child-sign-in` Edge Function. */
function takeChildCode(code: string): Promise<AuthUser> {
  if (requestsFail) return Promise.reject(new Error('Network error'));
  const key = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const child = childCodes.get(key);
  if (!child) {
    return Promise.reject(new LoginError('unknown-child-code', 'Unknown, used or expired code'));
  }
  childCodes.delete(key);
  return Promise.resolve(child);
}

function tokensFor(user: AuthUser) {
  return { userId: user.id, accessToken: `access:${user.id}`, refreshToken: `refresh:${user.id}` };
}

export const signInWithChildCode: typeof authApi.signInWithChildCode = async (code) => {
  setCurrentUser(await takeChildCode(code));
};

export const childSessionFromCode: typeof authApi.childSessionFromCode = async (code) => {
  const child = await takeChildCode(code);
  endedSessions.delete(child.id);
  return tokensFor(child);
};

export const endKeptSession: typeof authApi.endKeptSession = (tokens) => {
  if (requestsFail) return Promise.reject(new Error('Network error'));
  endedSessions.add(tokens.userId);
  return Promise.resolve();
};

export const currentSessionTokens: typeof authApi.currentSessionTokens = () =>
  Promise.resolve(currentUser && tokensFor(currentUser));

export const signInWithTokens: typeof authApi.signInWithTokens = (tokens) => {
  if (requestsFail) return Promise.reject(new Error('Network error'));
  if (endedSessions.has(tokens.userId)) return Promise.resolve(false);
  setCurrentUser(userWithId(tokens.userId));
  return Promise.resolve(true);
};

export const logOut: typeof authApi.logOut = () => {
  setCurrentUser(null);
  return Promise.resolve();
};

export const subscribeToAuthChanges: typeof authApi.subscribeToAuthChanges = (onChange) => {
  listeners.add(onChange);
  onChange(currentUser);
  return () => {
    listeners.delete(onChange);
  };
};

export const fetchOwnProfile: typeof authApi.fetchOwnProfile = (userId) =>
  loadingProfilesFails
    ? Promise.reject(new Error('Network error'))
    : Promise.resolve(profiles.get(userId) ?? null);

export const saveOwnProfile: typeof authApi.saveOwnProfile = (userId, displayName) => {
  profiles.set(userId, { displayName });
  return Promise.resolve();
};
