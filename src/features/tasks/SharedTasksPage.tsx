import { Navigate } from 'react-router';

import { paths } from '@/app/paths';

import { inputClassName } from '@/components/ui/formStyles';
import { SearchIcon } from '@/components/ui/icons';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { BoardFilters } from '@/features/tasks/BoardFilters';
import { DueTaskGroups } from '@/features/tasks/DueTaskGroups';
import { NewTaskLink } from '@/features/tasks/NewTaskLink';
import type { HouseholdMember } from '@/features/tasks/helpersApi';
import { nothingPickedUpMessage, usePickerFilter } from '@/features/tasks/pickerFilter';
import { PointsToAward } from '@/features/tasks/PointsToAward';
import { PriorityTasks } from '@/features/tasks/PriorityTasks';
import { RoutineChips } from '@/features/tasks/RoutineChips';
import type { Task } from '@/features/tasks/task';
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

const FILTER_PARAM = 'show';
const AVAILABLE_PARAM = 'available';
const SEARCH_PARAM = 'q';

/** The Shared tasks screen; children have none and are sent to their Me page, which lists the tasks free to pick. */
export function SharedTasksPage() {
  const user = useLoggedInUser();
  const isChild = useIsChild(user.id);
  if (isChild === undefined) return <LoadingMessage />;
  return isChild ? <Navigate to={paths.me} replace /> : <Board />;
}

/**
 * The board for adults: the shared tasks adults do, by due date, with a search and filters. Children's tasks are on
 * each child's page instead (ADR 0004).
 */
function Board() {
  const user = useLoggedInUser();
  const [due, setDue] = useDueFilterParam(user.id);
  const [availableOnly, setAvailableOnly] = useSwitchParam(AVAILABLE_PARAM, user.id);
  const { picker, members, setPickerId } = usePickerFilter(user.id);
  const [search, setSearch] = useSearchTextParam();
  const t = useMessages().tasks;

  // Tasks nobody has picked up and the tasks one member has picked up never overlap, so choosing one clears the
  // other rather than leaving the board empty.
  function showAvailableOnly(on: boolean) {
    setAvailableOnly(on);
    if (on) setPickerId(null);
  }
  function showPickedUpBy(pickerId: string | null) {
    setPickerId(pickerId);
    if (pickerId !== null) setAvailableOnly(false);
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title={t.board.title} />
        <NewTaskLink />
      </div>
      <PointsToAward />
      <div className="flex flex-col gap-3">
        <BoardFilters
          currentUserId={user.id}
          due={due}
          onDueChange={setDue}
          availableOnly={availableOnly}
          onAvailableOnlyChange={showAvailableOnly}
          members={members}
          picker={picker}
          onPickerChange={showPickedUpBy}
        >
          <SearchField search={search} onChange={setSearch} />
        </BoardFilters>
      </div>
      <TaskList filter={{ due, availableOnly }} picker={picker} search={search} />
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

interface TaskListProps {
  filter: TaskFilter;
  /** Only the tasks this member has picked up; null for everyone's. */
  picker: HouseholdMember | null;
  search: string;
}

/** The adults' shared tasks that the filters leave. */
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
  // Private tasks are listed only on the Me page, and children's on their pages. Priority tasks are at the top
  // whatever the filters.
  const shared = tasks.data.filter((task) => !task.isPrivate && !task.forChildren);
  const priority = shared.filter((task) => task.isPriority);
  const listed = shared.filter((task) => !task.isPriority);
  const shown = searchTasks(
    pickedUpBy(filterTasks(listed, filter, today()), picker?.id ?? null),
    search,
  );
  const searched = search.trim();
  const { routines, cards } = splitRoutines(shown, searched !== '');
  function emptyMessage(): string | null {
    if (listed.length === 0) return priority.length === 0 ? t.empty.all : null;
    if (searched !== '') return t.noMatches(searched);
    if (picker !== null) return nothingPickedUpMessage(picker, user.id, messages);
    return (filter.availableOnly ? t.emptyAvailable : t.empty)[filter.due];
  }
  const message = emptyMessage();
  return (
    <>
      {/* Mounted while the tasks show, so screen readers hear how many match as the search is typed. The priority
          tasks above stay whatever the search, so they aren't counted. */}
      <p role="status" className="sr-only">
        {searched === '' ? '' : t.matches(shown.length)}
      </p>
      <PriorityTasks tasks={priority} currentUserId={user.id} />
      <RoutineChips routines={routines} currentUserId={user.id} />
      {shown.length === 0 && message !== null && <EmptyMessage>{message}</EmptyMessage>}
      {cards.length > 0 && <DueTaskGroups tasks={cards} currentUserId={user.id} headingLevel={2} />}
    </>
  );
}

/** Routines are chips above the due dates, except in a search, which finds them as cards to open and edit. */
function splitRoutines(tasks: Task[], isSearching: boolean): { routines: Task[]; cards: Task[] } {
  if (isSearching) return { routines: [], cards: tasks };
  return {
    routines: tasks.filter((task) => task.isRoutine),
    cards: tasks.filter((task) => !task.isRoutine),
  };
}

function EmptyMessage({ children }: { children: string }) {
  return (
    <p className="border-line text-ink-muted mt-3 rounded-2xl border-2 border-dashed p-6 text-center text-sm">
      {children}
    </p>
  );
}
