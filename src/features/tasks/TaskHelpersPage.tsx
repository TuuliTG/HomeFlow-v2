import { type SyntheticEvent, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { paths } from '@/app/paths';
import { CancelLink } from '@/components/ui/CancelLink';
import { inputClassName } from '@/components/ui/formStyles';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import type { HelperBonus, HouseholdMember } from '@/features/tasks/helpersApi';
import { canChooseHelpers, type CompletedTask, MAX_HELPER_BONUS } from '@/features/tasks/task';
import { useHouseholdMembers, useSetTaskHelpers } from '@/features/tasks/useHelpers';
import { useCompletedTasks } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/** Each helper's bonus points by their user id; members who didn't help aren't in it. */
type Bonuses = Record<string, number>;

/**
 * Says who helped with a task the user marked done, e.g. a child helping with the laundry or another
 * adult sharing it, and gives each bonus points on top of the task's, which the user keeps (ADR 0004).
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
      <p role="alert" className="text-danger-700 text-sm">
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
    <p className="border-line-strong bg-surface text-ink-muted rounded-2xl border border-dashed p-6 text-sm">
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
  const [bonuses, setBonuses] = useState<Bonuses>(() =>
    Object.fromEntries(task.helpers.map((helper) => [helper.userId, helper.points])),
  );
  const summaryId = useId();
  const { common, tasks } = useMessages();
  const t = tasks.helpers;

  async function save(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const helpers: HelperBonus[] = others.flatMap(({ id }) => {
      const bonus = bonuses[id];
      return bonus === undefined ? [] : [{ userId: id, points: bonus }];
    });
    await setHelpers.mutateAsync({ taskId: task.id, helpers });
    await navigate(paths.me);
  }

  function toggle(memberId: string, helped: boolean) {
    const rest = Object.fromEntries(Object.entries(bonuses).filter(([id]) => id !== memberId));
    setBonuses(helped ? { ...rest, [memberId]: 1 } : rest);
  }

  if (others.length === 0) {
    return (
      <p className="border-line-strong bg-surface text-ink-muted rounded-2xl border border-dashed p-6 text-sm">
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
        <legend className="text-ink text-sm font-medium">{t.whoHelped}</legend>
        <ul className="divide-line flex flex-col divide-y">
          {others.map((member) => (
            <HelperRow
              key={member.id}
              name={member.name ?? common.newMember}
              bonus={bonuses[member.id]}
              onToggle={(helped) => {
                toggle(member.id, helped);
              }}
              onBonusChange={(bonus) => {
                setBonuses({ ...bonuses, [member.id]: bonus });
              }}
            />
          ))}
        </ul>
      </fieldset>
      <p id={summaryId} className="text-ink-muted text-sm">
        {t.youKeep(common.points(task.points ?? 0))}
      </p>
      {setHelpers.isError && (
        <p role="alert" className="text-danger-700 text-sm">
          {t.saveFailed}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={setHelpers.isPending}
          className="bg-brand-700 hover:bg-brand-900 flex-1 rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-60"
        >
          {common.save}
        </button>
        <CancelLink fallback={paths.me} />
      </div>
    </form>
  );
}

const bonusChoices = Array.from({ length: MAX_HELPER_BONUS }, (_, index) => index + 1);

function HelperRow({
  name,
  bonus,
  onToggle,
  onBonusChange,
}: {
  name: string;
  /** Undefined when they didn't help. */
  bonus: number | undefined;
  onToggle: (helped: boolean) => void;
  onBonusChange: (bonus: number) => void;
}) {
  const { common, tasks } = useMessages();
  const t = tasks.helpers;
  return (
    <li className="flex min-h-14 items-center justify-between gap-3">
      <label className="text-ink flex min-h-11 flex-1 items-center gap-3 text-base">
        <input
          type="checkbox"
          checked={bonus !== undefined}
          aria-label={t.helped(name)}
          onChange={(event) => {
            onToggle(event.target.checked);
          }}
          className="accent-brand-600 size-5"
        />
        {name}
      </label>
      {bonus !== undefined && (
        <select
          aria-label={t.bonusFor(name)}
          value={bonus}
          onChange={(event) => {
            onBonusChange(Number(event.target.value));
          }}
          className={`${inputClassName} w-fit`}
        >
          {bonusChoices.map((choice) => (
            <option key={choice} value={choice}>
              {common.points(choice)}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}
