import { useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { FoldButton } from '@/components/ui/FoldButton';
import { TaskIcon } from '@/components/ui/TaskIcon';
import { useFoldedParam } from '@/features/tasks/foldedParam';
import { useAlwaysTaskState } from '@/features/tasks/useAlwaysTaskState';
import type { Task } from '@/features/tasks/task';
import { useCompleteTask, useDeleteTask } from '@/features/tasks/useTasks';
import { today, toIsoDate } from '@/lib/dates';
import { type Messages, useMessages } from '@/lib/i18n/i18n';

interface RoutineChipsProps {
  /** The routines to show, all of them always available. */
  routines: Task[];
  currentUserId: string;
}

/**
 * Everyday chores, like emptying the dishwasher, as small chips instead of cards (ADR 0004). Tapping a chip opens
 * its menu: mark it done (it's always available, resting for a moment once done), edit or delete it. One done
 * today also shows who did it last.
 * They fold away behind their heading, which still counts those not done today. Nothing without routines.
 */
export function RoutineChips({ routines, currentUserId }: RoutineChipsProps) {
  const completeTask = useCompleteTask(currentUserId);
  const t = useMessages();
  const headingId = useId();
  const listId = useId();
  const [folded, setFolded] = useFoldedParam('routines', currentUserId);
  const sectionRef = useRef<HTMLElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = routines.find((routine) => routine.id === openId);
  const todayDate = today();
  const toDo = routines.filter((routine) => !isDoneToday(routine, todayDate)).length;

  if (routines.length === 0) return null;
  return (
    <section ref={sectionRef} aria-labelledby={headingId} className="flex flex-col gap-3 pt-2">
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
              onOpen={() => {
                setOpenId(routine.id);
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
      {open && (
        <RoutineMenu
          routine={open}
          canMarkDone={!completeTask.isPending}
          onDone={() => {
            completeTask.mutate(open);
            setOpenId(null);
          }}
          onClose={() => {
            setOpenId(null);
          }}
          // After a delete: the heading's fold button.
          fallbackFocus={() => sectionRef.current?.querySelector('button')}
          currentUserId={currentUserId}
        />
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
  onOpen: () => void;
  currentUserId: string;
  t: Messages;
}

function RoutineChip({ routine, isDoneToday, onOpen, currentUserId, t }: RoutineChipProps) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onOpen}
      className={`hover:bg-brand-50 flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${isDoneToday ? 'border-line bg-page text-ink-muted' : 'border-brand-600 bg-surface text-ink font-semibold'}`}
    >
      {routine.icon && <TaskIcon name={routine.icon} className="text-base" />}
      <span className="truncate">{routine.title}</span>
      {isDoneToday && (
        <span className="text-xs font-normal whitespace-nowrap">
          {doneByLabel(routine, currentUserId, t)}
        </span>
      )}
    </button>
  );
}

interface RoutineMenuProps {
  routine: Task;
  canMarkDone: boolean;
  onDone: () => void;
  onClose: () => void;
  fallbackFocus: () => HTMLElement | null | undefined;
  currentUserId: string;
}

/** What can be done with a routine: mark it done (unless it's resting), edit or delete it. */
function RoutineMenu({
  routine,
  canMarkDone,
  onDone,
  onClose,
  fallbackFocus,
  currentUserId,
}: RoutineMenuProps) {
  const isResting = useAlwaysTaskState(routine).kind === 'resting';
  const deleteTask = useDeleteTask(currentUserId);
  const { common, tasks, taskForm } = useMessages();
  return (
    <BottomSheet
      title={
        <>
          {routine.icon && <TaskIcon name={routine.icon} className="text-lg" />}
          <span className="truncate">{routine.title}</span>
        </>
      }
      onClose={onClose}
      fallbackFocus={fallbackFocus}
    >
      <div className="flex flex-col gap-2">
        {!isResting && (
          <button
            type="button"
            disabled={!canMarkDone}
            onClick={onDone}
            className="bg-brand-700 hover:bg-brand-900 min-h-11 rounded-xl px-4 font-bold text-white disabled:opacity-60"
          >
            {tasks.card.markDone}
          </button>
        )}
        <Link
          to={paths.editTask(routine.id)}
          className="text-ink hover:bg-page flex min-h-11 items-center justify-center rounded-xl px-4 font-semibold"
        >
          {tasks.card.edit}
        </Link>
        <button
          type="button"
          disabled={deleteTask.isPending}
          // The menu closes once the routine is gone from the list, and with its chip gone the focus falls back;
          // a failure shows through isError.
          onClick={() => {
            deleteTask.mutate(routine);
          }}
          className="text-danger-700 hover:bg-danger-50 min-h-11 rounded-xl px-4 font-semibold disabled:opacity-60"
        >
          {common.delete}
        </button>
        {deleteTask.isError && (
          <p role="alert" className="text-danger-700 text-center text-sm">
            {taskForm.edit.deleteFailed}
          </p>
        )}
      </div>
    </BottomSheet>
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
