import { createContext, useContext } from 'react';

/**
 * The logged-in user, shared by every feature that needs to know who is using the app.
 * `AuthProvider` in the auth feature keeps it up to date.
 */
export interface AuthUser {
  id: string;
  email: string;
}

/** Another account signed in on this device, ready to switch to without logging in (ADR 0003). */
export interface OtherAccount {
  userId: string;
  displayName: string;
}

/** Switching found that the account's session has ended, so it was taken off this device. */
export class AccountSignedOutError extends Error {
  constructor() {
    super("The account's session on this device has ended");
    this.name = 'AccountSignedOutError';
  }
}

export interface AuthState {
  /** `loading` until the stored session has been checked on startup. */
  status: 'loading' | 'ready';
  user: AuthUser | null;
  logOut: () => Promise<void>;
  /** The accounts waiting on this device, the most recently used first. */
  otherAccounts: OtherAccount[];
  /**
   * Continues as one of `otherAccounts`; the current account waits in its place. Rejects with
   * `AccountSignedOutError` if that account's session has ended.
   */
  switchAccount: (userId: string) => Promise<void>;
  /** Signs a child in with their sign-in code on this device; the current account waits meanwhile. */
  signInChildOnThisDevice: (code: string) => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}

/** The logged-in user, for screens that `OnboardingGate` only shows after logging in. */
export function useLoggedInUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error('useLoggedInUser must be used on a screen that requires logging in');
  return user;
}
