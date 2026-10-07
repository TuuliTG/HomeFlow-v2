import { type ReactNode, useMemo, useState } from 'react';

import { AuthContext, type AuthState } from '@/features/auth/authContext';
import { loadMockUser, type MockUser, saveMockUser } from '@/features/auth/mockSession';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<MockUser | null>(loadMockUser);

  const auth = useMemo<AuthState>(() => {
    function update(next: MockUser | null) {
      saveMockUser(next);
      setUser(next);
    }
    return {
      user,
      logIn: (name) => {
        update({ name: name.trim() });
      },
      logOut: () => {
        update(null);
      },
    };
  }, [user]);

  return <AuthContext value={auth}>{children}</AuthContext>;
}
