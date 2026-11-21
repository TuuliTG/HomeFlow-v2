import { type SyntheticEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { paths } from '@/app/paths';
import { CancelLink } from '@/components/ui/CancelLink';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { TaskTypeIcon } from '@/components/ui/TaskTypeIcon';
import { childTaskList, scheduleOf, tasksToCopy } from '@/features/tasks/childTasks';
import type { Task } from '@/features/tasks/task';
import { useHouseholdMembers } from '@/features/tasks/useHelpers';
import { useCopyTasks, useTasks } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * Choosing which of a child's tasks to copy to another child (ADR 0004): those the other child lacks start ticked,
 * those they have under the same name already can't be ticked. Copying goes back to the first child's page.
 */
export function CopyChildTasksPage() {
  const { childId = '', toChildId = '' } = useParams();
  const user = useLoggedInUser();
  const members = useHouseholdMembers(user.id);
  const tasks = useTasks(user.id);
  const t = useMessages();

  if (members.data === undefined || tasks.data === undefined) {
    if (!members.isError && !tasks.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.tasks.me.loadFailed}
      </p>
    );
  }
  const to = otherChild(members.data, childId, toChildId);
  if (!to) {
    return <p className="text-ink-muted text-sm">{t.tasks.childTasks.notFound}</p>;
  }
  const name = to.name ?? t.common.someone;
  const { always, custom } = childTaskList(tasks.data, childId);
  return (
    <>
      <PageHeader title={t.tasks.childTasks.copyTo(name)} />
      <CopyForm
        tasks={[...always, ...custom]}
        copyable={tasksToCopy(tasks.data, childId, toChildId)}
        fromChildId={childId}
        toChildId={toChildId}
        toName={name}
      />
    </>
  );
}

interface Member {
  id: string;
  name: string | null;
  isChild: boolean;
}

/** The child to copy to, if both are children of the family and not the same one. */
function otherChild(members: Member[], fromChildId: string, toChildId: string): Member | undefined {
  const children = members.filter((member) => member.isChild);
  if (fromChildId === toChildId || !children.some((child) => child.id === fromChildId))
    return undefined;
  return children.find((child) => child.id === toChildId);
}

interface CopyFormProps {
  /** The first child's tasks, in the order of their page. */
  tasks: Task[];
  /** Those the other child lacks, which can be copied. */
  copyable: Task[];
  fromChildId: string;
  toChildId: string;
  toName: string;
}

/** A tick box for each task, all those that can be copied ticked to begin with, and a button copying them. */
function CopyForm({ tasks, copyable, fromChildId, toChildId, toName }: CopyFormProps) {
  const user = useLoggedInUser();
  const copyTasks = useCopyTasks(user.id);
  const navigate = useNavigate();
  const [chosen, setChosen] = useState(() => new Set(copyable.map((task) => task.id)));
  const t = useMessages().tasks.childTasks;
  const canCopy = new Set(copyable.map((task) => task.id));

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    copyTasks
      .mutateAsync({ tasks: copyable.filter((task) => chosen.has(task.id)), childId: toChildId })
      .then(
        () =>
          navigate(paths.childTasks(fromChildId), {
            replace: true,
            state: { copiedTo: toChildId },
          }),
        () => undefined,
      );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t.pickToCopy}</legend>
        {tasks.map((task) => (
          <TaskChoice
            key={task.id}
            task={task}
            note={canCopy.has(task.id) ? null : t.alreadyHas(toName)}
            checked={chosen.has(task.id)}
            onChange={(checked) => {
              setChosen((current) => {
                const next = new Set(current);
                if (checked) next.add(task.id);
                else next.delete(task.id);
                return next;
              });
            }}
          />
        ))}
      </fieldset>
      {copyTasks.isError && (
        <p role="alert" className="text-danger-700 text-sm">
          {t.copyFailed}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={chosen.size === 0 || copyTasks.isPending}
          className="bg-brand-700 hover:bg-brand-900 flex-1 rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-60"
        >
          {t.copySubmit(chosen.size)}
        </button>
        <CancelLink fallback={paths.childTasks(fromChildId)} />
      </div>
    </form>
  );
}

interface TaskChoiceProps {
  task: Task;
  /** Why it can't be ticked, e.g. the other child has it already; null when it can. */
  note: string | null;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A task as a big row to tick: its icon, name and when it comes up. */
function TaskChoice({ task, note, checked, onChange }: TaskChoiceProps) {
  const t = useMessages();
  return (
    <label
      className={`bg-surface shadow-card flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 ${note ? 'opacity-60' : 'cursor-pointer'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={note !== null}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="accent-brand-600 size-5 shrink-0"
      />
      <TaskTypeIcon type={task.type} icon={task.icon} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ink font-bold break-words">{task.title}</span>
        <span className="text-ink-muted text-xs font-semibold">{note ?? scheduleOf(task, t)}</span>
      </span>
    </label>
  );
}
