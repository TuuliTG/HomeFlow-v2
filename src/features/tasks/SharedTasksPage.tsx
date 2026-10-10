import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { DueTaskGroups } from '@/features/tasks/DueTaskGroups';
import { HouseholdCompletedTasks } from '@/features/tasks/HouseholdCompletedTasks';
import { NewTaskLink } from '@/features/tasks/NewTaskLink';
import type { Task } from '@/features/tasks/task';
import { useTasks } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';

const SHOW_COMPLETED_PARAM = 'completed';
const ONLY_UNPICKED_PARAM = 'unpicked';

export function SharedTasksPage() {
  const [showCompleted, setShowCompleted] = useSwitchParam(SHOW_COMPLETED_PARAM);
  const [onlyUnpicked, setOnlyUnpicked] = useSwitchParam(ONLY_UNPICKED_PARAM);

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
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Switch label="Only tasks to pick up" checked={onlyUnpicked} onChange={setOnlyUnpicked} />
        <Switch label="Show completed" checked={showCompleted} onChange={setShowCompleted} />
      </div>
      <TaskList onlyUnpicked={onlyUnpicked} />
      {showCompleted && <HouseholdCompletedTasks />}
    </>
  );
}

/**
 * An on/off choice kept in the address as `?<name>=1`, so it survives a reload. Local state keeps
 * the switch from flickering while the router updates the address.
 */
function useSwitchParam(name: string): [boolean, (on: boolean) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOn, setIsOn] = useState(() => searchParams.get(name) === '1');

  function set(on: boolean) {
    setIsOn(on);
    setSearchParams(
      (params) => {
        if (on) params.set(name, '1');
        else params.delete(name);
        return params;
      },
      { replace: true },
    );
  }

  return [isOn, set];
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

/** Whether anyone could still pick the task up. */
function isUnpicked(task: Task): boolean {
  return task.pickedUpBy === null;
}

function TaskList({ onlyUnpicked }: { onlyUnpicked: boolean }) {
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
    return <EmptyMessage>No tasks yet. Create the first one!</EmptyMessage>;
  }
  const shown = onlyUnpicked ? shared.filter(isUnpicked) : shared;
  if (shown.length === 0) {
    return <EmptyMessage>Every task has been picked up.</EmptyMessage>;
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
