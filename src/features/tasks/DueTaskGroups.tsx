import { useId } from 'react';

import { groupByDueDate, today } from '@/features/tasks/dueDate';
import type { Task } from '@/features/tasks/task';
import { TaskCard } from '@/features/tasks/TaskCard';

interface DueTaskGroupsProps {
  /** Sorted soonest due first, tasks without a due date last. */
  tasks: Task[];
  currentUserId: string;
  /** Level of the group headings; task titles go one level below. */
  headingLevel: 2 | 3;
}

/** Tasks under headings for when they are due: Overdue, Today, Tomorrow, each day of the week, Later. */
export function DueTaskGroups({ tasks, currentUserId, headingLevel }: DueTaskGroupsProps) {
  return (
    <div className="flex flex-col gap-6 pt-2">
      {groupByDueDate(tasks, today()).map((group) => (
        <DueTaskGroup
          key={group.label}
          label={group.label}
          tasks={group.items}
          currentUserId={currentUserId}
          headingLevel={headingLevel}
        />
      ))}
    </div>
  );
}

function DueTaskGroup({
  label,
  tasks,
  currentUserId,
  headingLevel,
}: Omit<DueTaskGroupsProps, 'tasks'> & { label: string; tasks: Task[] }) {
  const headingId = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <Heading
        id={headingId}
        className={[
          'text-sm font-semibold tracking-wide uppercase',
          label === 'Overdue' ? 'text-red-700' : 'text-slate-600',
        ].join(' ')}
      >
        {label}
      </Heading>
      <ul className="flex flex-col gap-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            currentUserId={currentUserId}
            titleLevel={headingLevel === 2 ? 3 : 4}
          />
        ))}
      </ul>
    </section>
  );
}
