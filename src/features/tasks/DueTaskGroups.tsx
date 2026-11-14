import { useId } from 'react';

import { FoldButton } from '@/components/ui/FoldButton';
import { type DueGroup, type DueStatus, groupByDueDate } from '@/features/tasks/dueDate';
import { useFoldedParam } from '@/features/tasks/foldedParam';
import { today } from '@/lib/dates';
import { useMessages } from '@/lib/i18n/i18n';
import type { Task } from '@/features/tasks/task';
import { TaskCard } from '@/features/tasks/TaskCard';

interface DueTaskGroupsProps {
  /** Sorted soonest due first, tasks without a due date last. */
  tasks: Task[];
  currentUserId: string;
  /** Level of the group headings; task titles go one level below. */
  headingLevel: 2 | 3;
}

/**
 * Tasks under headings for when they are due: Overdue, Today, Tomorrow, the next five days by date, Later
 * and No due date. Each group folds away behind its heading, e.g. so a backlog doesn't push today's tasks off
 * the screen; the folded groups are kept in the address and remembered on this device by the group's key.
 */
export function DueTaskGroups({ tasks, currentUserId, headingLevel }: DueTaskGroupsProps) {
  const t = useMessages();
  return (
    <div className="flex flex-col gap-6 pt-2">
      {groupByDueDate(tasks, today(), t).map((group) => (
        <DueTaskGroup
          key={group.key}
          group={group}
          currentUserId={currentUserId}
          headingLevel={headingLevel}
        />
      ))}
    </div>
  );
}

const headingClassNames: Record<DueStatus, { text: string; dot: string; count: string }> = {
  overdue: { text: 'text-overdue-800', dot: 'bg-overdue-600', count: 'bg-overdue-100' },
  today: { text: 'text-due-today-800', dot: 'bg-due-today-500', count: 'bg-due-today-100' },
  upcoming: { text: 'text-ink-muted', dot: 'bg-ink-muted/60', count: 'bg-line' },
};

interface DueTaskGroupProps extends Omit<DueTaskGroupsProps, 'tasks'> {
  group: DueGroup<Task>;
}

function DueTaskGroup({
  group: { key, label, status, items: tasks },
  currentUserId,
  headingLevel,
}: DueTaskGroupProps) {
  const labelId = useId();
  const listId = useId();
  const [folded, setFolded] = useFoldedParam(key, currentUserId);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const { text, dot, count } = headingClassNames[status];

  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-3">
      <Heading
        className={`flex items-center gap-2 text-sm font-extrabold tracking-wide uppercase ${text}`}
      >
        <FoldButton
          folded={folded}
          onFoldedChange={setFolded}
          controls={listId}
          count={tasks.length}
          countClassName={count}
        >
          <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
          <span id={labelId}>{label}</span>
        </FoldButton>
      </Heading>
      <ul id={listId} hidden={folded} className="flex flex-col gap-3">
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
