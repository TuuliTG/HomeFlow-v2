import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { logOut, subscribeToAuthChanges } from '@/features/auth/api';
import { AuthContext, type AuthState, type AuthUser } from '@/lib/auth';

interface AuthProviderProps {
  children: ReactNode;
}

interface Session {
  status: AuthState['status'];
  user: AuthUser | null;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session>({ status: 'loading', user: null });

  useEffect(
    () =>
      subscribeToAuthChanges((user) => {
        setSession({ status: 'ready', user });
      }),
    [],
  );

  const auth = useMemo<AuthState>(
    () => ({
      ...session,
      logOut: async () => {
        await logOut();
        // Don't leave the previous user's data cached on a shared device.
        queryClient.clear();
      },
    }),
    [session, queryClient],
  );

  return <AuthContext value={auth}>{children}</AuthContext>;
}
