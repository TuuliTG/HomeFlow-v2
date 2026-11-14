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
 * and No due date. The overdue tasks can be folded away, so a backlog doesn't push today's off the screen.
 */
export function DueTaskGroups({ tasks, currentUserId, headingLevel }: DueTaskGroupsProps) {
  const t = useMessages();
  const [overdueHidden, setOverdueHidden] = useFoldedParam('overdue', currentUserId);
  return (
    <div className="flex flex-col gap-6 pt-2">
      {groupByDueDate(tasks, today(), t).map((group) => (
        <DueTaskGroup
          key={group.label}
          group={group}
          currentUserId={currentUserId}
          headingLevel={headingLevel}
          {...(group.status === 'overdue' && {
            folded: overdueHidden,
            onFoldedChange: setOverdueHidden,
          })}
        />
      ))}
    </div>
  );
}

const headingClassNames: Record<DueStatus, { text: string; dot: string }> = {
  overdue: { text: 'text-overdue-800', dot: 'bg-overdue-600' },
  today: { text: 'text-due-today-800', dot: 'bg-due-today-500' },
  upcoming: { text: 'text-ink-muted', dot: 'bg-ink-muted/60' },
};

interface DueTaskGroupProps extends Omit<DueTaskGroupsProps, 'tasks'> {
  group: DueGroup<Task>;
  /** Whether the tasks are folded away; only groups given `onFoldedChange` can be. */
  folded?: boolean;
  onFoldedChange?: (folded: boolean) => void;
}

function DueTaskGroup({
  group: { label, status, items: tasks },
  currentUserId,
  headingLevel,
  folded = false,
  onFoldedChange,
}: DueTaskGroupProps) {
  const labelId = useId();
  const listId = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const { text, dot } = headingClassNames[status];
  const title = (
    <>
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
      <span id={labelId}>{label}</span>
    </>
  );

  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-3">
      <Heading
        className={`flex items-center gap-2 text-sm font-extrabold tracking-wide uppercase ${text}`}
      >
        {onFoldedChange === undefined ? (
          title
        ) : (
          <FoldButton
            folded={folded}
            onFoldedChange={onFoldedChange}
            controls={listId}
            count={tasks.length}
            countClassName="bg-overdue-100"
          >
            {title}
          </FoldButton>
        )}
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
