import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { paths } from '@/app/paths';
import { useOwnProfile } from '@/features/auth/useOwnProfile';
import { useOwnHousehold } from '@/features/household/useHousehold';
import { useAuth } from '@/lib/auth';

interface OnboardingGateProps {
  children: ReactNode;
}

/**
 * Makes a logged-in user finish onboarding: first choose a display name, then create or join a
 * household. It redirects only once it knows a step is missing and never hides the app while
 * loading, so a failed request can't lock the user out (or remount the app in a retry loop).
 */
export function OnboardingGate({ children }: OnboardingGateProps) {
  const { user } = useAuth();
  const profile = useOwnProfile(user?.id);
  const household = useOwnHousehold(user?.id);

  if (profile.data === null) return <Navigate to={paths.login} replace />;
  if (household.data === null) return <Navigate to={paths.householdSetup} replace />;
  return children;
}
