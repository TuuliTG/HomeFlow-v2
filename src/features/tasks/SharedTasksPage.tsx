import { inputClassName } from '@/components/ui/formStyles';
import { SearchIcon } from '@/components/ui/icons';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { DueTaskGroups } from '@/features/tasks/DueTaskGroups';
import { FilterChoice } from '@/features/tasks/FilterChoice';
import { HouseholdCompletedTasks } from '@/features/tasks/HouseholdCompletedTasks';
import { NewTaskLink } from '@/features/tasks/NewTaskLink';
import type { HouseholdMember } from '@/features/tasks/helpersApi';
import { PickerChoice } from '@/features/tasks/PickerChoice';
import { nothingPickedUpMessage, usePickerFilter } from '@/features/tasks/pickerFilter';
import { PointsToAward } from '@/features/tasks/PointsToAward';
import { ChildBoard } from '@/features/tasks/ChildBoard';
import { useIsChild, useTasks } from '@/features/tasks/useTasks';
import { today } from '@/lib/dates';
import {
  type DueFilter,
  filterTasks,
  parseDueFilter,
  pickedUpBy,
  searchTasks,
  type TaskFilter,
} from '@/features/tasks/taskFilter';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';
import { useSearchParam } from '@/lib/useSearchParam';

const SHOW_COMPLETED_PARAM = 'completed';
const FILTER_PARAM = 'show';
const AVAILABLE_PARAM = 'available';
const SEARCH_PARAM = 'q';

export function SharedTasksPage() {
  const user = useLoggedInUser();
  const isChild = useIsChild(user.id);
  if (isChild === undefined) return <LoadingMessage />;
  return isChild ? <ChildBoard completed={<CompletedTasks />} /> : <Board />;
}

/**
 * The board for adults: every shared task by due date, with a search, filters (also by who has picked tasks up)
 * and the household's completed tasks.
 */
function Board() {
  const user = useLoggedInUser();
  const [showCompleted, setShowCompleted] = useSwitchParam(SHOW_COMPLETED_PARAM, user.id);
  const [due, setDue] = useDueFilterParam(user.id);
  const [availableOnly, setAvailableOnly] = useSwitchParam(AVAILABLE_PARAM, user.id);
  const { picker, members, setPickerId } = usePickerFilter(user.id);
  const [search, setSearch] = useSearchTextParam();
  const t = useMessages().tasks;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow={t.eyebrow} title={t.board.title} />
        <NewTaskLink />
      </div>
      <PointsToAward />
      <div className="flex flex-col gap-3">
        <SearchField search={search} onChange={setSearch} />
        <FilterChoice
          due={due}
          onDueChange={setDue}
          availableOnly={availableOnly}
          onAvailableOnlyChange={setAvailableOnly}
        />
        <PickerChoice
          currentUserId={user.id}
          members={members}
          picker={picker}
          onChange={setPickerId}
        />
        <Switch label={t.board.showCompleted} checked={showCompleted} onChange={setShowCompleted} />
      </div>
      <TaskList filter={{ due, availableOnly }} picker={picker} search={search} />
      {showCompleted && <HouseholdCompletedTasks />}
    </>
  );
}

/** "Show completed" below a child's tiles, which lists the household's recently done tasks (for children). */
function CompletedTasks() {
  const user = useLoggedInUser();
  const [showCompleted, setShowCompleted] = useSwitchParam(SHOW_COMPLETED_PARAM, user.id);
  const t = useMessages().tasks.board;
  return (
    <>
      <Switch label={t.showCompleted} checked={showCompleted} onChange={setShowCompleted} />
      {showCompleted && <HouseholdCompletedTasks />}
    </>
  );
}

/** An on/off choice kept in the address as `?<name>=1` and remembered on this device. */
function useSwitchParam(name: string, userId: string) {
  return useSearchParam({
    name,
    parse: (value) => value === '1',
    serialise: (on) => (on ? '1' : null),
    rememberAs: `board.${name}:${userId}`,
  });
}

/**
 * Which due dates to show, kept in the address as `?show=<filter>` and remembered on this device; all tasks by
 * default.
 */
function useDueFilterParam(userId: string) {
  return useSearchParam<DueFilter>({
    name: FILTER_PARAM,
    parse: parseDueFilter,
    serialise: (filter) => (filter === 'all' ? null : filter),
    rememberAs: `board.${FILTER_PARAM}:${userId}`,
  });
}

/**
 * What to search for, kept in the address as `?q=<search>` so it survives a reload. Not remembered on this
 * device: a search left over from last time would hide tasks without anyone noticing.
 */
function useSearchTextParam() {
  return useSearchParam({
    name: SEARCH_PARAM,
    parse: (value) => value ?? '',
    serialise: (search) => (search === '' ? null : search),
  });
}

interface SearchFieldProps {
  search: string;
  onChange: (search: string) => void;
}

/** Finds tasks by title or description, e.g. to check whether someone already added one. */
function SearchField({ search, onChange }: SearchFieldProps) {
  const t = useMessages().tasks.board;
  return (
    <div role="search" className="relative">
      <SearchIcon className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2" />
      <input
        type="search"
        aria-label={t.search}
        placeholder={t.search}
        value={search}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={`${inputClassName} min-h-11 w-full pl-10`}
      />
    </div>
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

interface TaskListProps {
  filter: TaskFilter;
  /** Only the tasks this member has picked up; null for everyone's. */
  picker: HouseholdMember | null;
  search: string;
}

function TaskList({ filter, picker, search }: TaskListProps) {
  const user = useLoggedInUser();
  const tasks = useTasks(user.id);
  const messages = useMessages();
  const t = messages.tasks.board;

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
  const shown = searchTasks(
    pickedUpBy(filterTasks(shared, filter, today()), picker?.id ?? null),
    search,
  );
  const searched = search.trim();
  function emptyMessage(): string {
    if (searched !== '') return t.noMatches(searched);
    if (picker !== null) return nothingPickedUpMessage(picker, user.id, messages);
    return (filter.availableOnly ? t.emptyAvailable : t.empty)[filter.due];
  }
  return (
    <>
      {/* Mounted while the tasks show, so screen readers hear how many match as the search is typed. */}
      <p role="status" className="sr-only">
        {searched === '' ? '' : t.matches(shown.length)}
      </p>
      {shown.length === 0 ? (
        <EmptyMessage>{emptyMessage()}</EmptyMessage>
      ) : (
        <DueTaskGroups tasks={shown} currentUserId={user.id} headingLevel={2} />
      )}
    </>
  );
}

function EmptyMessage({ children }: { children: string }) {
  return (
    <p className="border-line text-ink-muted rounded-2xl border-2 border-dashed p-6 text-center text-sm">
      {children}
    </p>
  );
}
