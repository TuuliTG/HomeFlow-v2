import { useNavigate } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import type { GoalSetter } from '@/features/rewards/goal';
import { GoalForm } from '@/features/rewards/GoalForm';
import { useAddGoal, useGoalSetters } from '@/features/rewards/useGoals';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/** Only adults set goals, shared by the members they choose or for one member (ADR 0007). */
export function NewGoalPage() {
  const user = useLoggedInUser();
  const setters = useGoalSetters(user.id);
  const messages = useMessages();

  return (
    <>
      <PageHeader
        eyebrow={messages.rewards.eyebrow}
        title={messages.rewards.newGoal}
        description={messages.rewards.form.description}
      />
      {setters.isPending ? (
        <LoadingMessage />
      ) : setters.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {messages.rewards.loadFailed}
        </p>
      ) : setters.isAdult ? (
        <NewGoal userId={user.id} members={setters.data} />
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          {messages.rewards.form.onlyAdults}
        </p>
      )}
    </>
  );
}

function NewGoal({ userId, members }: { userId: string; members: GoalSetter[] }) {
  const addGoal = useAddGoal(userId);
  const navigate = useNavigate();
  const t = useMessages().rewards.form;
  return (
    <GoalForm
      userId={userId}
      members={members}
      submitLabel={t.submit}
      isSaving={addGoal.isPending}
      onSave={async (goal) => {
        await addGoal.mutateAsync(goal);
        await navigate(paths.rewards);
      }}
    />
  );
}
