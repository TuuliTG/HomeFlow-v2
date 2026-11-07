import { useQueryClient } from '@tanstack/react-query';
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigate } from 'react-router';

import { paths } from '@/app/paths';
import { signInChildOnThisDevice, switchToDeviceAccount } from '@/features/auth/accountSwitching';
import { logOut, subscribeToAuthChanges } from '@/features/auth/api';
import { readDeviceAccounts } from '@/features/auth/deviceAccounts';
import { AuthContext, type AuthState, type AuthUser, type OtherAccount } from '@/lib/auth';

interface AuthProviderProps {
  children: ReactNode;
  /** Runs while still logged in, just before logging out (e.g. to stop this device's notifications). */
  beforeLogOut?: () => Promise<void>;
}

interface Session {
  status: AuthState['status'];
  user: AuthUser | null;
}

function readOtherAccounts(): OtherAccount[] {
  return readDeviceAccounts().map(({ userId, displayName }) => ({ userId, displayName }));
}

export function AuthProvider({ children, beforeLogOut }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session>({ status: 'loading', user: null });
  const [otherAccounts, setOtherAccounts] = useState(readOtherAccounts);

  const navigate = useNavigate();
  const userId = useRef<string | null>(null);

  useEffect(
    () =>
      subscribeToAuthChanges((user) => {
        // Don't show one member's data to another on a shared device: drop it before anything renders
        // for the next account (on logging out, or switching to another account on this device).
        if (userId.current && userId.current !== user?.id) queryClient.clear();
        userId.current = user?.id ?? null;
        setSession({ status: 'ready', user });
      }),
    [queryClient],
  );

  /**
   * Runs a switch to another account, which then starts on its Me page. Either way the accounts waiting on
   * this device may have changed.
   */
  const switching = useCallback(
    async (change: Promise<void>) => {
      try {
        await change;
        void navigate(paths.me);
      } finally {
        setOtherAccounts(readOtherAccounts());
      }
    },
    [navigate],
  );

  const auth = useMemo<AuthState>(
    () => ({
      ...session,
      otherAccounts,
      logOut: async () => {
        await beforeLogOut?.();
        await logOut();
      },
      switchAccount: (userId) => switching(switchToDeviceAccount(userId)),
      signInChildOnThisDevice: (code) => switching(signInChildOnThisDevice(code)),
    }),
    [session, otherAccounts, beforeLogOut, switching],
  );

  // Another account starts the screens afresh, so nothing of the previous one's stays on them.
  return (
    <AuthContext value={auth}>
      <Fragment key={session.user?.id}>{children}</Fragment>
    </AuthContext>
  );
}
