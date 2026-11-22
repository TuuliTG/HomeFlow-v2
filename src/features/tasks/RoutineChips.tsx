import { useId } from 'react';

import { FoldButton } from '@/components/ui/FoldButton';
import { CheckIcon } from '@/components/ui/icons';
import { TaskIcon } from '@/components/ui/TaskIcon';
import { useFoldedParam } from '@/features/tasks/foldedParam';
import type { Task } from '@/features/tasks/task';
import { useCompleteTask } from '@/features/tasks/useTasks';
import { today, toIsoDate } from '@/lib/dates';
import { type Messages, useMessages } from '@/lib/i18n/i18n';

interface RoutineChipsProps {
  /** The routines to show, all of them always available. */
  routines: Task[];
  currentUserId: string;
}

/**
 * Everyday chores, like emptying the dishwasher, as small chips instead of cards (ADR 0004). A routine is always
 * available, so each chip is a button that marks it done with one tap; one done today also shows who did it last.
 * They fold away behind their heading, which still counts those not done today. Nothing without routines.
 */
export function RoutineChips({ routines, currentUserId }: RoutineChipsProps) {
  const completeTask = useCompleteTask(currentUserId);
  const t = useMessages();
  const headingId = useId();
  const listId = useId();
  const [folded, setFolded] = useFoldedParam('routines', currentUserId);
  const todayDate = today();
  const toDo = routines.filter((routine) => !isDoneToday(routine, todayDate)).length;

  if (routines.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 pt-2">
      <h2 className="text-ink-muted flex items-center gap-2 text-sm font-extrabold tracking-wide uppercase">
        <FoldButton
          folded={folded}
          onFoldedChange={setFolded}
          controls={listId}
          count={toDo}
          countClassName="bg-brand-50 text-brand-900"
        >
          <span id={headingId}>{t.tasks.routines.heading}</span>
        </FoldButton>
      </h2>
      <ul id={listId} hidden={folded} className="flex flex-wrap gap-2">
        {routines.map((routine) => (
          <li key={routine.id} className="max-w-full">
            <RoutineChip
              routine={routine}
              isDoneToday={isDoneToday(routine, todayDate)}
              disabled={completeTask.isPending}
              onDone={() => {
                completeTask.mutate(routine);
              }}
              currentUserId={currentUserId}
              t={t}
            />
          </li>
        ))}
      </ul>
      {completeTask.isError && (
        <p role="alert" className="text-danger-700 text-xs">
          {t.tasks.card.failures.complete}
        </p>
      )}
    </section>
  );
}

/** Done today: marking it done added a fresh copy, which remembers who did it last. */
function isDoneToday(routine: Task, todayDate: string): boolean {
  return routine.lastDone !== null && toIsoDate(new Date(routine.lastDone.at)) === todayDate;
}

interface RoutineChipProps {
  routine: Task;
  isDoneToday: boolean;
  disabled: boolean;
  onDone: () => void;
  currentUserId: string;
  t: Messages;
}

function RoutineChip({
  routine,
  isDoneToday,
  disabled,
  onDone,
  currentUserId,
  t,
}: RoutineChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onDone}
      className={`hover:bg-brand-50 flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm disabled:opacity-60 ${isDoneToday ? 'border-line bg-page text-ink-muted' : 'border-brand-600 bg-surface text-ink font-semibold'}`}
    >
      {isDoneToday && <CheckIcon className="text-brand-600 size-4 shrink-0" />}
      {routine.icon && <TaskIcon name={routine.icon} className="text-base" />}
      <span className="truncate">
        <span className="sr-only">{t.tasks.card.markDone}:</span> {routine.title}
      </span>
      {isDoneToday && (
        <span className="text-xs font-normal whitespace-nowrap">
          {doneByLabel(routine, currentUserId, t)}
        </span>
      )}
    </button>
  );
}

/** Who did the routine last: "Done by you", "Done by Anna" or "Done by someone". */
function doneByLabel(routine: Task, currentUserId: string, t: Messages): string {
  const doneBy = t.tasks.completed.doneBy;
  const by = routine.lastDone?.by;
  const name = routine.lastDone?.name;
  if (by === currentUserId) return doneBy.you;
  return name ? doneBy.named(name) : doneBy.someone;
}
