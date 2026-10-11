import { type SyntheticEvent, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { paths } from '@/app/paths';
import { CancelLink } from '@/components/ui/CancelLink';
import { inputClassName } from '@/components/ui/formStyles';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import type { HelperShare, HouseholdMember } from '@/features/tasks/helpersApi';
import { canChooseHelpers, type CompletedTask } from '@/features/tasks/task';
import {
  useCompletedTasks,
  useHouseholdMembers,
  useSetTaskHelpers,
} from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/** Each helper's share by their user id; members who didn't help aren't in it. */
type Shares = Record<string, number>;

/**
 * Says who helped with a task the user marked done, e.g. a child helping with the laundry or another
 * adult sharing it, and gives each some of its points (ADR 0004).
 */
export function TaskHelpersPage() {
  const user = useLoggedInUser();
  const { taskId } = useParams();
  const completed = useCompletedTasks(user.id);
  // Checked when the page opens; the database has the final say.
  const [now] = useState(() => Date.now());
  const found = completed.data?.find((candidate) => candidate.id === taskId);
  const task = found && canChooseHelpers(found, now) ? found : undefined;
  const { common, tasks } = useMessages();
  const t = tasks.helpers;

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        {...(task && { description: t.description(task.title, common.points(task.points ?? 0)) })}
      />
      <HelpersBody task={task} completed={completed} userId={user.id} />
    </>
  );
}

/** The form once the task and the household have loaded, or why it can't be shown. */
function HelpersBody({
  task,
  completed,
  userId,
}: {
  task: CompletedTask | undefined;
  completed: ReturnType<typeof useCompletedTasks>;
  userId: string;
}) {
  const members = useHouseholdMembers(userId);
  const t = useMessages().tasks.helpers;

  if (completed.isPending || members.isPending) return <LoadingMessage />;
  if (completed.isError || members.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {t.loadFailed}
      </p>
    );
  }
  if (!task) return <Unavailable />;
  return (
    <HelpersForm
      task={task}
      others={members.data.filter((member) => member.id !== userId)}
      userId={userId}
    />
  );
}

function Unavailable() {
  const { tasks } = useMessages();
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
      {tasks.helpers.unavailable}{' '}
      <Link to={paths.me} className="text-brand-900 font-semibold underline">
        {tasks.me.title}
      </Link>
    </p>
  );
}

function HelpersForm({
  task,
  others,
  userId,
}: {
  task: CompletedTask;
  others: HouseholdMember[];
  userId: string;
}) {
  const setHelpers = useSetTaskHelpers(userId);
  const navigate = useNavigate();
  const [shares, setShares] = useState<Shares>(() =>
    Object.fromEntries(task.helpers.map((helper) => [helper.userId, helper.points])),
  );
  const summaryId = useId();
  const { common, tasks } = useMessages();
  const t = tasks.helpers;
  const points = task.points ?? 0;
  const given = Object.values(shares).reduce((total, share) => total + share, 0);
  const isTooMany = given > points;

  async function save(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (isTooMany) return;
    const helpers: HelperShare[] = others.flatMap(({ id }) => {
      const share = shares[id];
      return share === undefined ? [] : [{ userId: id, points: share }];
    });
    await setHelpers.mutateAsync({ taskId: task.id, helpers });
    await navigate(paths.me);
  }

  function toggle(memberId: string, helped: boolean) {
    const rest = Object.fromEntries(Object.entries(shares).filter(([id]) => id !== memberId));
    if (!helped) {
      setShares(rest);
      return;
    }
    // An even split with whoever is already helping, at least a point.
    const helping = Object.keys(rest).length;
    setShares({ ...rest, [memberId]: Math.max(1, Math.floor(points / (helping + 2))) });
  }

  if (others.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
        {t.noOneElse}
      </p>
    );
  }
  return (
    <form
      noValidate
      onSubmit={(event) => {
        // A failure shows below the form; the choices stay to try again.
        save(event).catch(() => undefined);
      }}
      className="flex flex-col gap-5"
    >
      <fieldset aria-describedby={summaryId} className="flex flex-col gap-1">
        <legend className="text-sm font-medium text-slate-700">{t.whoHelped}</legend>
        <ul className="flex flex-col divide-y divide-slate-200">
          {others.map((member) => (
            <HelperRow
              key={member.id}
              name={member.name ?? common.newMember}
              share={shares[member.id]}
              maxPoints={points}
              onToggle={(helped) => {
                toggle(member.id, helped);
              }}
              onShareChange={(share) => {
                setShares({ ...shares, [member.id]: share });
              }}
            />
          ))}
        </ul>
      </fieldset>
      <p
        id={summaryId}
        role={isTooMany ? 'alert' : undefined}
        className={isTooMany ? 'text-sm text-red-700' : 'text-sm text-slate-600'}
      >
        {isTooMany ? t.tooMany(common.points(points)) : t.youKeep(common.points(points - given))}
      </p>
      {setHelpers.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t.saveFailed}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={setHelpers.isPending || isTooMany}
          className="bg-brand-600 hover:bg-brand-900 flex-1 rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {common.save}
        </button>
        <CancelLink fallback={paths.me} />
      </div>
    </form>
  );
}

function HelperRow({
  name,
  share,
  maxPoints,
  onToggle,
  onShareChange,
}: {
  name: string;
  /** Undefined when they didn't help. */
  share: number | undefined;
  maxPoints: number;
  onToggle: (helped: boolean) => void;
  onShareChange: (share: number) => void;
}) {
  const { common, tasks } = useMessages();
  const t = tasks.helpers;
  const choices = Array.from({ length: maxPoints }, (_, index) => index + 1);
  return (
    <li className="flex min-h-14 items-center justify-between gap-3">
      <label className="flex min-h-11 flex-1 items-center gap-3 text-base text-slate-900">
        <input
          type="checkbox"
          checked={share !== undefined}
          aria-label={t.helped(name)}
          onChange={(event) => {
            onToggle(event.target.checked);
          }}
          className="accent-brand-600 size-5"
        />
        {name}
      </label>
      {share !== undefined && (
        <select
          aria-label={t.pointsFor(name)}
          value={share}
          onChange={(event) => {
            onShareChange(Number(event.target.value));
          }}
          className={`${inputClassName} w-fit`}
        >
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {common.points(choice)}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}
