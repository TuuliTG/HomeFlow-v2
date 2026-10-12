import { Link, useNavigate, useParams } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import type { Goal, GoalSetter } from '@/features/rewards/goal';
import { ForAdults } from '@/features/rewards/ForAdults';
import { GoalForm } from '@/features/rewards/GoalForm';
import { useGoals, useUpdateGoal } from '@/features/rewards/useGoals';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/** Only adults change goals, and only open ones: claimed goals stay as history (ADR 0007). */
export function EditGoalPage() {
  const user = useLoggedInUser();
  const { goalId } = useParams();
  const goals = useGoals(user.id);
  const goal = goals.data?.find(({ id, claimedAt }) => id === goalId && claimedAt === null);
  const t = useMessages().rewards;

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.form.edit.title}
        description={t.form.edit.description}
      />
      <ForAdults userId={user.id}>
        {(members) =>
          goal ? (
            <EditGoal goal={goal} userId={user.id} members={members} />
          ) : goals.isPending ? (
            <LoadingMessage />
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
              {t.form.edit.notFound}{' '}
              <Link to={paths.rewards} className="text-brand-900 font-semibold underline">
                {t.form.edit.backToRewards}
              </Link>
            </p>
          )
        }
      </ForAdults>
    </>
  );
}

function EditGoal({
  goal,
  userId,
  members,
}: {
  goal: Goal;
  userId: string;
  members: GoalSetter[];
}) {
  const updateGoal = useUpdateGoal(userId);
  const navigate = useNavigate();
  const t = useMessages().rewards.form;
  return (
    <GoalForm
      userId={userId}
      members={members}
      initial={goal}
      submitLabel={t.edit.submit}
      isSaving={updateGoal.isPending}
      onSave={async (changed) => {
        await updateGoal.mutateAsync({ goalId: goal.id, goal: changed });
        await navigate(paths.rewards);
      }}
    />
  );
}
