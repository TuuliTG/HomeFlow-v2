import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { canAskWhoHelped } from '@/features/tasks/task';
import { useHouseholdMembers } from '@/features/tasks/useHelpers';
import { useLastDoneTask } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/** How long the prompt stays up unless dismissed; "Who helped?" on the Me page stays for a week. */
export const WHO_HELPED_PROMPT_DURATION_MS = 12_000;

/**
 * Right after the user marks a shared task with points done, asks whether someone helped, linking to
 * the form that shares its points (ADR 0004). Not asked when nobody else is in the household. The live
 * region is always present so screen readers announce the question.
 */
export function WhoHelpedPrompt() {
  const user = useLoggedInUser();
  const last = useLastDoneTask();
  const members = useHouseholdMembers(user.id);
  // When the last prompt was answered, dismissed or timed out; later completions ask again.
  const [closedAt, setClosedAt] = useState(0);
  const { tasks } = useMessages();
  const prompt =
    last && last.at > closedAt && canAskWhoHelped(last.task) && (members.data?.length ?? 0) > 1
      ? last
      : undefined;

  useEffect(() => {
    if (!prompt) return;
    const timer = setTimeout(() => {
      setClosedAt(prompt.at);
    }, WHO_HELPED_PROMPT_DURATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [prompt]);

  const close = () => {
    if (prompt) setClosedAt(prompt.at);
  };

  return (
    <div
      className={[
        'flex max-w-sm items-center gap-2 rounded-2xl bg-slate-900 py-1.5 pr-2 pl-4 text-sm text-white shadow-lg',
        prompt ? 'pointer-events-auto' : 'sr-only',
      ].join(' ')}
    >
      <p role="status" className="min-w-0">
        {prompt && <span key={prompt.at}>{tasks.helpers.askAfterDone(prompt.task.title)}</span>}
      </p>
      {prompt && (
        <>
          <Link
            to={paths.taskHelpers(prompt.task.id)}
            onClick={close}
            aria-label={tasks.helpers.whoHelpedLabel(prompt.task.title)}
            className="flex min-h-11 shrink-0 items-center rounded-full px-2 font-semibold whitespace-nowrap text-white underline underline-offset-2 hover:bg-slate-700"
          >
            {tasks.helpers.whoHelped}
          </Link>
          <button
            type="button"
            onClick={close}
            className="min-h-11 shrink-0 rounded-full px-2 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <span aria-hidden="true">✕</span>
            <span className="sr-only">{tasks.activity.dismiss}</span>
          </button>
        </>
      )}
    </div>
  );
}
