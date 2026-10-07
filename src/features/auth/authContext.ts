import { createContext, useContext } from 'react';

import type { MockUser } from '@/features/auth/mockSession';

export interface AuthState {
  user: MockUser | null;
  logIn: (name: string) => void;
  logOut: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}
