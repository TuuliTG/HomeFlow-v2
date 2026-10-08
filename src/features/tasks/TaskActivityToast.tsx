import { useEffect } from 'react';

import { TASK_ACTIVITY_DURATION_MS, useTaskActivity } from '@/features/tasks/useTaskActivity';
import { useLoggedInUser } from '@/lib/auth';

/**
 * Live updates while the app is open: refreshes the task board when anyone in the household adds a
 * task, and briefly says who added what. The live region is always present so screen readers
 * announce each message.
 */
export function TaskActivityToast() {
  const user = useLoggedInUser();
  const { activity, dismiss } = useTaskActivity(user.id);

  useEffect(() => {
    if (!activity) return;
    const timer = setTimeout(dismiss, TASK_ACTIVITY_DURATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [activity, dismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4 md:bottom-6">
      <div
        className={[
          'flex max-w-sm items-center gap-3 rounded-full bg-slate-900 py-2 pr-2 pl-4 text-sm text-white shadow-lg',
          activity ? 'pointer-events-auto' : 'sr-only',
        ].join(' ')}
      >
        <p role="status" className="min-w-0 truncate">
          {activity && <span key={activity.id}>{activity.message}</span>}
        </p>
        {activity && (
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-full px-2 py-0.5 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <span aria-hidden="true">✕</span>
            <span className="sr-only">Dismiss</span>
          </button>
        )}
      </div>
    </div>
  );
}
