import { createContext, useContext } from 'react';

/**
 * The logged-in user, shared by every feature that needs to know who is using the app.
 * `AuthProvider` in the auth feature keeps it up to date.
 */
export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthState {
  /** `loading` until the stored session has been checked on startup. */
  status: 'loading' | 'ready';
  user: AuthUser | null;
  logOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}
