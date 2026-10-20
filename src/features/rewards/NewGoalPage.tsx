import { useNavigate } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { type GoalSetter, membersWithOpenGoal } from '@/features/rewards/goal';
import { ForAdults } from '@/features/rewards/ForAdults';
import { GoalForm } from '@/features/rewards/GoalForm';
import { useAddGoal, useGoals } from '@/features/rewards/useGoals';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * Only adults set goals, shared by the members they choose or for one member, each member one open goal
 * of each kind at a time (ADR 0007).
 */
export function NewGoalPage() {
  const user = useLoggedInUser();
  const t = useMessages().rewards;

  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={t.newGoal} />
      <ForAdults userId={user.id}>
        {(members) => <NewGoal userId={user.id} members={members} />}
      </ForAdults>
    </>
  );
}

function NewGoal({ userId, members }: { userId: string; members: GoalSetter[] }) {
  const goals = useGoals(userId);
  const addGoal = useAddGoal(userId);
  const navigate = useNavigate();
  const t = useMessages().rewards.form;
  // Without the goals the form still works: the database refuses a second open goal.
  if (goals.isPending) return <LoadingMessage />;
  return (
    <GoalForm
      userId={userId}
      members={members}
      busy={membersWithOpenGoal(goals.data ?? [])}
      submitLabel={t.submit}
      isSaving={addGoal.isPending}
      onSave={async (goal) => {
        await addGoal.mutateAsync(goal);
        await navigate(paths.rewards);
      }}
    />
  );
}
