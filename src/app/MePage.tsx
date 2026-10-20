import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { StarJars } from '@/features/rewards/StarJars';
import { ChildMePage } from '@/features/tasks/ChildMePage';
import { MyTasksPage } from '@/features/tasks/MyTasksPage';
import { useCompletedTasks, useMembership } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';

/** The Me page: for a child their goals as star jars above big task tiles, for an adult their tasks. */
export function MePage() {
  const user = useLoggedInUser();
  const membership = useMembership(user.id);
  // Wait only for the first answer. If it fails, the adults' page still works for a child (it shows only
  // what they may see), and it asks again, which mustn't swap it for this message and back.
  if (membership.isPending && membership.errorUpdateCount === 0) return <LoadingMessage />;
  return membership.data?.isChild ? <ChildMePage goals={<ChildGoals />} /> : <MyTasksPage />;
}

/** The child's goals, refreshed when their completed tasks change, so the jar fills as they do them. */
function ChildGoals() {
  const user = useLoggedInUser();
  const completed = useCompletedTasks(user.id);
  return <StarJars pointsChangedAt={completed.dataUpdatedAt} />;
}
