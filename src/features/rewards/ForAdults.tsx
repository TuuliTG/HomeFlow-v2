import type { ReactNode } from 'react';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import type { GoalSetter } from '@/features/rewards/goal';
import { useGoalSetters } from '@/features/rewards/useGoals';
import { useMessages } from '@/lib/i18n/i18n';

/** Only adults set and change goals (ADR 0007): shows `children` the household's members once loaded. */
export function ForAdults({
  userId,
  children,
}: {
  userId: string;
  children: (members: GoalSetter[]) => ReactNode;
}) {
  const setters = useGoalSetters(userId);
  const t = useMessages().rewards;
  if (setters.isPending) return <LoadingMessage />;
  if (setters.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {t.loadFailed}
      </p>
    );
  }
  if (!setters.isAdult) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
        {t.form.onlyAdults}
      </p>
    );
  }
  return children(setters.data);
}
