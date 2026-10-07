import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { useOwnProfile } from '@/features/auth/useOwnProfile';
import { useOwnHousehold } from '@/features/household/useHousehold';
import { useAuth } from '@/lib/auth';

interface OnboardingGateProps {
  children: ReactNode;
}

/**
 * The app is for logged-in family members: visitors are sent to log in, then to choose a display
 * name and to create or join a household. Past the login check it redirects only once it knows a
 * step is missing and never hides the app while loading, so a failed request can't lock the user
 * out (or remount the app in a retry loop).
 */
export function OnboardingGate({ children }: OnboardingGateProps) {
  const { status, user } = useAuth();
  const profile = useOwnProfile(user?.id);
  const household = useOwnHousehold(user?.id);

  if (status === 'loading') return <LoadingMessage />;
  if (!user) return <Navigate to={paths.login} replace />;
  if (profile.data === null) return <Navigate to={paths.login} replace />;
  if (household.data === null) return <Navigate to={paths.householdSetup} replace />;
  return children;
}
