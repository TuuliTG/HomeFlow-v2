import { useId, useState } from 'react';

import { ChevronDownIcon } from '@/components/ui/icons';
import { TaskIcon } from '@/components/ui/TaskIcon';
import { describeDueDate } from '@/features/tasks/dueDate';
import type { Task } from '@/features/tasks/task';
import { TaskCard } from '@/features/tasks/TaskCard';
import { today } from '@/lib/dates';
import { useMessages } from '@/lib/i18n/i18n';

interface PriorityTasksProps {
  /** The tasks marked a priority, soonest due first. */
  tasks: Task[];
  currentUserId: string;
}

/**
 * The tasks marked a priority, at the top of the board whatever its filters (ADR 0004), as short rows. Tapping one
 * opens its card below it, to pick it up, mark it done and the rest. Nothing without priority tasks.
 */
export function PriorityTasks({ tasks, currentUserId }: PriorityTasksProps) {
  const t = useMessages();
  const headingId = useId();
  const [openId, setOpenId] = useState<string | null>(null);

  if (tasks.length === 0) return null;
  return (
    <section
      aria-labelledby={headingId}
      className="bg-brand-900 shadow-hero mt-2 flex flex-col gap-2 rounded-2xl p-3"
    >
      <h2 id={headingId} className="px-1 text-sm font-extrabold tracking-wide text-white uppercase">
        {t.tasks.priority.heading}
      </h2>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <PriorityTask
            key={task.id}
            task={task}
            isOpen={task.id === openId}
            onOpenChange={(isOpen) => {
              setOpenId(isOpen ? task.id : null);
            }}
            currentUserId={currentUserId}
          />
        ))}
      </ul>
    </section>
  );
}

interface PriorityTaskProps {
  task: Task;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentUserId: string;
}

function PriorityTask({ task, isOpen, onOpenChange, currentUserId }: PriorityTaskProps) {
  const t = useMessages();
  const cardId = useId();
  return (
    <li className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={cardId}
        onClick={() => {
          onOpenChange(!isOpen);
        }}
        className="bg-brand-700 hover:bg-brand-600 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-left text-white"
      >
        {task.icon && <TaskIcon name={task.icon} className="text-xl" />}
        <span className="flex min-w-0 flex-col">
          <span className="font-bold break-words">{task.title}</span>
          {/* Open, its card shows when it is due. */}
          {!isOpen && task.dueOn !== null && (
            <span className="text-brand-100 text-xs">
              {describeDueDate(task.dueOn, today(), t)}
            </span>
          )}
        </span>
        <ChevronDownIcon className={`ml-auto size-5 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div id={cardId} hidden={!isOpen}>
        {isOpen && (
          <TaskCard as="section" task={task} currentUserId={currentUserId} titleLevel={3} />
        )}
      </div>
    </li>
  );
}
