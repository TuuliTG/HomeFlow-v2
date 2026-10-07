import type * as authApi from '@/features/auth/api';
import type { Profile } from '@/features/auth/api';
import type { AuthUser } from '@/lib/auth';

/**
 * In-memory stand-in for `@/features/auth/api`, installed for every unit test in `setup.ts`.
 * The "backend" lives in module state, so it survives unmounting the app like a real session.
 */
export const FAKE_LOGIN_CODE = '123456';

let currentUser: AuthUser | null = null;
let sendingFails = false;
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
    sendingFails = false;
    profiles.clear();
    listeners.clear();
  },
  /** Starts the next render already logged in, optionally with a saved profile. */
  logInAs(email: string, displayName?: string) {
    const user = userFor(email);
    if (displayName) profiles.set(user.id, { displayName });
    currentUser = user;
  },
  failSendingCodes() {
    sendingFails = true;
  },
};

export const sendLoginCode: typeof authApi.sendLoginCode = () =>
  sendingFails ? Promise.reject(new Error('Email rate limit exceeded')) : Promise.resolve();

export const verifyLoginCode: typeof authApi.verifyLoginCode = (email, code) => {
  if (code !== FAKE_LOGIN_CODE) return Promise.reject(new Error('Token has expired or is invalid'));
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
  Promise.resolve(profiles.get(userId) ?? null);

export const saveOwnProfile: typeof authApi.saveOwnProfile = (userId, displayName) => {
  profiles.set(userId, { displayName });
  return Promise.resolve();
};
