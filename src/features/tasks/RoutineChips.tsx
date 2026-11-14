import { useId } from 'react';

import { FoldButton } from '@/components/ui/FoldButton';
import { CheckIcon } from '@/components/ui/icons';
import { TaskIcon } from '@/components/ui/TaskIcon';
import { useFoldedParam } from '@/features/tasks/foldedParam';
import type { Task } from '@/features/tasks/task';
import { useCompleteTask } from '@/features/tasks/useTasks';
import { today } from '@/lib/dates';
import { type Messages, useMessages } from '@/lib/i18n/i18n';

interface RoutineChipsProps {
  /** The routines to show, all of them repeating. */
  routines: Task[];
  currentUserId: string;
}

/**
 * Everyday chores, like emptying the dishwasher, as small chips instead of cards (ADR 0004). A routine that
 * is due is a button that marks it done with one tap; one done until its next due date shows who did it.
 * They fold away behind their heading, which still counts those left to do. Nothing without routines.
 */
export function RoutineChips({ routines, currentUserId }: RoutineChipsProps) {
  const completeTask = useCompleteTask(currentUserId);
  const t = useMessages();
  const headingId = useId();
  const listId = useId();
  const [folded, setFolded] = useFoldedParam('routines', currentUserId);
  const todayDate = today();
  const toDo = routines.filter((routine) => !isDoneForNow(routine, todayDate)).length;

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
            {isDoneForNow(routine, todayDate) ? (
              <DoneChip routine={routine} currentUserId={currentUserId} t={t} />
            ) : (
              <button
                type="button"
                aria-label={`${t.tasks.card.markDone}: ${routine.title}`}
                disabled={completeTask.isPending}
                onClick={() => {
                  completeTask.mutate(routine);
                }}
                className={`${chipClassName} ${
                  routine.dueOn !== null && routine.dueOn < todayDate
                    ? 'border-overdue-600 bg-overdue-100 text-overdue-800'
                    : 'border-brand-600 bg-surface text-ink hover:bg-brand-50'
                } font-semibold disabled:opacity-60`}
              >
                <ChipTitle routine={routine} />
              </button>
            )}
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

const chipClassName =
  'flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm';

/** Done until its next due date: marking it done added the next occurrence, due later. */
function isDoneForNow(routine: Task, todayDate: string): boolean {
  return routine.lastDone !== null && routine.dueOn !== null && routine.dueOn > todayDate;
}

function ChipTitle({ routine }: { routine: Task }) {
  return (
    <>
      {routine.icon && <TaskIcon name={routine.icon} className="text-base" />}
      <span className="truncate">{routine.title}</span>
    </>
  );
}

interface DoneChipProps {
  routine: Task;
  currentUserId: string;
  t: Messages;
}

function DoneChip({ routine, currentUserId, t }: DoneChipProps) {
  const doneBy = t.tasks.completed.doneBy;
  const by = routine.lastDone?.by;
  const name = routine.lastDone?.name;
  let label = doneBy.someone;
  if (by === currentUserId) label = doneBy.you;
  else if (name) label = doneBy.named(name);

  return (
    <span className={`${chipClassName} border-line bg-page text-ink-muted`}>
      <CheckIcon className="text-brand-600 size-4 shrink-0" />
      <ChipTitle routine={routine} />
      <span className="text-xs whitespace-nowrap">{label}</span>
    </span>
  );
}
