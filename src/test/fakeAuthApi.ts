import type * as authApi from '@/features/auth/api';
import type { Profile } from '@/features/auth/api';
import { LoginError } from '@/features/auth/loginError';
import type { AuthUser } from '@/lib/auth';

/**
 * In-memory stand-in for `@/features/auth/api`, installed for every unit test in `setup.ts`.
 * The "backend" lives in module state, so it survives unmounting the app like a real session.
 */
/** Password of every account created with `logInAs` or `addAccount`. */
export const FAKE_PASSWORD = 'correct horse';

let currentUser: AuthUser | null = null;
/** Email → password of every account. */
const passwords = new Map<string, string>();
let requestsFail = false;
let loadingProfilesFails = false;
const profiles = new Map<string, Profile>();
const listeners = new Set<(user: AuthUser | null) => void>();

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
