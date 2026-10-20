import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { DueTaskGroups } from '@/features/tasks/DueTaskGroups';
import { HouseholdCompletedTasks } from '@/features/tasks/HouseholdCompletedTasks';
import { NewTaskLink } from '@/features/tasks/NewTaskLink';
import { PointsToAward } from '@/features/tasks/PointsToAward';
import { ChildBoard } from '@/features/tasks/ChildBoard';
import { useIsChild, useTasks } from '@/features/tasks/useTasks';
import { today } from '@/lib/dates';
import {
  filterTasks,
  parseTaskFilter,
  type TaskFilter,
  taskFilters,
} from '@/features/tasks/taskFilter';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';
import { useSearchParam } from '@/lib/useSearchParam';

const SHOW_COMPLETED_PARAM = 'completed';
const FILTER_PARAM = 'show';

export function SharedTasksPage() {
  const user = useLoggedInUser();
  const isChild = useIsChild(user.id);
  if (isChild === undefined) return <LoadingMessage />;
  return isChild ? <ChildBoard completed={<CompletedTasks />} /> : <Board />;
}

/** The board for adults: every shared task by due date, with filters and the household's completed tasks. */
function Board() {
  const [showCompleted, setShowCompleted] = useSwitchParam(SHOW_COMPLETED_PARAM);
  const [filter, setFilter] = useFilterParam();
  const t = useMessages().tasks;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow={t.eyebrow} title={t.board.title} />
        <NewTaskLink />
      </div>
      <PointsToAward />
      <div className="flex flex-col gap-3">
        <FilterChoice filter={filter} onChange={setFilter} />
        <Switch label={t.board.showCompleted} checked={showCompleted} onChange={setShowCompleted} />
      </div>
      <TaskList filter={filter} />
      {showCompleted && <HouseholdCompletedTasks />}
    </>
  );
}

/** "Show completed" below a child's tiles, which lists the household's recently done tasks (for children). */
function CompletedTasks() {
  const [showCompleted, setShowCompleted] = useSwitchParam(SHOW_COMPLETED_PARAM);
  const t = useMessages().tasks.board;
  return (
    <>
      <Switch label={t.showCompleted} checked={showCompleted} onChange={setShowCompleted} />
      {showCompleted && <HouseholdCompletedTasks />}
    </>
  );
}

/** An on/off choice kept in the address as `?<name>=1`. */
function useSwitchParam(name: string) {
  return useSearchParam(
    name,
    (value) => value === '1',
    (on) => (on ? '1' : null),
  );
}

/** Which tasks to show, kept in the address as `?show=<filter>`; all tasks by default. */
function useFilterParam() {
  return useSearchParam<TaskFilter>(FILTER_PARAM, parseTaskFilter, (filter) =>
    filter === 'all' ? null : filter,
  );
}

interface FilterChoiceProps {
  filter: TaskFilter;
  onChange: (filter: TaskFilter) => void;
}

/** One tap to pick which tasks the board shows. */
function FilterChoice({ filter, onChange }: FilterChoiceProps) {
  const t = useMessages().tasks.board;
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{t.show}</legend>
      <span aria-hidden="true" className="text-ink-muted text-sm font-semibold">
        {t.show}:
      </span>
      {taskFilters.map((option) => (
        <label
          key={option}
          className="has-checked:bg-brand-900 has-focus-visible:outline-brand-600 bg-surface text-brand-900 shadow-card hover:bg-brand-50 flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold has-checked:font-bold has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2"
        >
          <input
            type="radio"
            name="task-filter"
            value={option}
            checked={filter === option}
            onChange={() => {
              onChange(option);
            }}
            className="sr-only"
          />
          {t.filters[option]}
        </label>
      ))}
    </fieldset>
  );
}

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Switch({ label, checked, onChange }: SwitchProps) {
  return (
    <label className="text-ink-muted flex min-h-11 w-fit items-center gap-2 text-sm font-semibold">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="accent-brand-600 size-4"
      />
      {label}
    </label>
  );
}

function TaskList({ filter }: { filter: TaskFilter }) {
  const user = useLoggedInUser();
  const tasks = useTasks(user.id);
  const t = useMessages().tasks.board;

  // A failed refresh keeps showing the tasks already loaded.
  if (tasks.data === undefined) {
    if (!tasks.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.loadFailed}
      </p>
    );
  }
  // Private tasks are listed only on the Me page.
  const shared = tasks.data.filter((task) => !task.isPrivate);
  if (shared.length === 0) {
    return <EmptyMessage>{t.empty.all}</EmptyMessage>;
  }
  const shown = filterTasks(shared, filter, today());
  if (shown.length === 0) {
    return <EmptyMessage>{t.empty[filter]}</EmptyMessage>;
  }
  return <DueTaskGroups tasks={shown} currentUserId={user.id} headingLevel={2} />;
}

function EmptyMessage({ children }: { children: string }) {
  return (
    <p className="border-line text-ink-muted rounded-2xl border-2 border-dashed p-6 text-center text-sm">
      {children}
    </p>
  );
}
