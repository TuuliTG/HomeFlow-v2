import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { DueTaskGroups } from '@/features/tasks/DueTaskGroups';
import { HouseholdCompletedTasks } from '@/features/tasks/HouseholdCompletedTasks';
import { NewTaskLink } from '@/features/tasks/NewTaskLink';
import { useTasks } from '@/features/tasks/useTasks';
import { today } from '@/features/tasks/dueDate';
import {
  filterTasks,
  parseTaskFilter,
  type TaskFilter,
  taskFilterEmptyMessages,
  taskFilterLabels,
  taskFilters,
} from '@/features/tasks/taskFilter';
import { useLoggedInUser } from '@/lib/auth';
import { useSearchParam } from '@/lib/useSearchParam';

const SHOW_COMPLETED_PARAM = 'completed';
const FILTER_PARAM = 'show';

export function SharedTasksPage() {
  const [showCompleted, setShowCompleted] = useSwitchParam(SHOW_COMPLETED_PARAM);
  const [filter, setFilter] = useFilterParam();

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Tasks"
          title="Shared tasks"
          description="Pick any task. New tasks earn bonus points for variety and fairness. Your private tasks are on your Me page."
        />
        <NewTaskLink />
      </div>
      <div className="flex flex-col gap-3">
        <FilterChoice filter={filter} onChange={setFilter} />
        <Switch label="Show completed" checked={showCompleted} onChange={setShowCompleted} />
      </div>
      <TaskList filter={filter} />
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
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">Show</legend>
      <span aria-hidden="true" className="text-sm font-medium text-slate-700">
        Show:
      </span>
      {taskFilters.map((option) => (
        <label
          key={option}
          className="has-checked:border-brand-600 has-checked:bg-brand-600 has-focus-visible:outline-brand-600 flex min-h-11 cursor-pointer items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:border-slate-400 has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2"
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
          {taskFilterLabels[option]}
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
    <label className="flex w-fit items-center gap-2 text-sm font-medium text-slate-700">
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

  // A failed refresh keeps showing the tasks already loaded.
  if (tasks.data === undefined) {
    if (!tasks.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-sm text-red-700">
        We couldn&apos;t load the tasks. Check your connection and reload the page.
      </p>
    );
  }
  // Private tasks are listed only on the Me page.
  const shared = tasks.data.filter((task) => !task.isPrivate);
  if (shared.length === 0) {
    return <EmptyMessage>{taskFilterEmptyMessages.all}</EmptyMessage>;
  }
  const shown = filterTasks(shared, filter, today());
  if (shown.length === 0) {
    return <EmptyMessage>{taskFilterEmptyMessages[filter]}</EmptyMessage>;
  }
  return <DueTaskGroups tasks={shown} currentUserId={user.id} headingLevel={2} />;
}

function EmptyMessage({ children }: { children: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
      {children}
    </p>
  );
}
