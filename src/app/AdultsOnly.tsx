import { Navigate, Outlet } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { useIsChild } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';

/**
 * Screens children don't have (News, Rewards, Statistics): a child is sent to their Me page, which shows
 * their goals' progress instead.
 */
export function AdultsOnly() {
  const user = useLoggedInUser();
  const isChild = useIsChild(user.id);
  if (isChild === undefined) return <LoadingMessage />;
  return isChild ? <Navigate to={paths.me} replace /> : <Outlet />;
}
