import { type SyntheticEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { paths } from '@/app/paths';
import { CancelLink } from '@/components/ui/CancelLink';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import type { HouseholdMember } from '@/features/tasks/helpersApi';
import { canRequest, membersToAsk, type Task } from '@/features/tasks/task';
import { useHouseholdMembers } from '@/features/tasks/useHelpers';
import { useRequestTask } from '@/features/tasks/useRequests';
import { useTasks } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * Asks another member to do a task (ADR 0004). They are notified and accept, which picks it up for them,
 * or decline; nobody gets a task without saying yes.
 */
export function AskForTaskPage() {
  const user = useLoggedInUser();
  const { taskId } = useParams();
  const tasks = useTasks(user.id);
  const members = useHouseholdMembers(user.id);
  const found = tasks.data?.find((candidate) => candidate.id === taskId);
  const task = found && canRequest(found, user.id) ? found : undefined;
  const t = useMessages().tasks.requests;

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        {...(task && { description: t.description(task.title) })}
      />
      {tasks.isPending || members.isPending ? (
        <LoadingMessage />
      ) : tasks.isError || members.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {t.loadFailed}
        </p>
      ) : task ? (
        <AskForm task={task} candidates={membersToAsk(task, members.data, user.id)} />
      ) : (
        <Unavailable />
      )}
    </>
  );
}

function Unavailable() {
  const { tasks } = useMessages();
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
      {tasks.requests.unavailable}{' '}
      <Link to={paths.tasks} className="text-brand-900 font-semibold underline">
        {tasks.board.title}
      </Link>
    </p>
  );
}

function AskForm({ task, candidates }: { task: Task; candidates: HouseholdMember[] }) {
  const user = useLoggedInUser();
  const requestTask = useRequestTask(user.id);
  const navigate = useNavigate();
  const [memberId, setMemberId] = useState<string | null>(null);
  const { common, tasks } = useMessages();
  const t = tasks.requests;

  async function send(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (memberId === null) return;
    await requestTask.mutateAsync({ taskId: task.id, memberId });
    await navigate(paths.tasks);
  }

  if (candidates.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
        {t.noOne}
      </p>
    );
  }
  return (
    <form
      noValidate
      onSubmit={(event) => {
        // A failure shows below the form; the choice stays to try again.
        send(event).catch(() => undefined);
      }}
      className="flex flex-col gap-5"
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium text-slate-700">{t.whoToAsk}</legend>
        <ul className="flex flex-col divide-y divide-slate-200">
          {candidates.map((member) => (
            <li key={member.id}>
              <label className="flex min-h-14 items-center gap-3 text-base text-slate-900">
                <input
                  type="radio"
                  name="member"
                  value={member.id}
                  checked={memberId === member.id}
                  onChange={() => {
                    setMemberId(member.id);
                  }}
                  className="accent-brand-600 size-5"
                />
                {member.name ?? common.newMember}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {requestTask.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t.sendFailed}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={requestTask.isPending || memberId === null}
          className="bg-brand-600 hover:bg-brand-900 flex-1 rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {t.send}
        </button>
        <CancelLink fallback={paths.tasks} />
      </div>
    </form>
  );
}
