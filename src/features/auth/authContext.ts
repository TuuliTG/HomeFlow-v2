import { createContext, useContext } from 'react';

import type { AuthUser } from '@/features/auth/api';

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
