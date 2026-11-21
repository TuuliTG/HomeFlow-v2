import { useId, useState } from 'react';

import { TaskIcon } from '@/components/ui/TaskIcon';
import { FormFoldButton } from '@/features/tasks/FormFoldButton';
import type { TaskSuggestion } from '@/features/tasks/task';
import { useMessages } from '@/lib/i18n/i18n';

interface ReadyMadeTaskListProps {
  /** The ready-made tasks for whoever the task is for (`readyMadeTasks`). */
  tasks: TaskSuggestion[];
  onPick: (task: TaskSuggestion) => void;
}

/**
 * Everyday chores to start from, folded away so they don't fill the form. Opened, each is a button that fills
 * in the form, to adjust before saving.
 */
export function ReadyMadeTaskList({ tasks, onPick }: ReadyMadeTaskListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const contentId = useId();
  const t = useMessages().taskForm.readyMade;
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <FormFoldButton
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        controls={contentId}
        titleId={titleId}
        title={t.heading}
      />
      <ul id={contentId} hidden={!isOpen} className="flex flex-wrap gap-2">
        {tasks.map((task) => (
          <li key={task.title}>
            <button
              type="button"
              onClick={() => {
                onPick(task);
              }}
              className="hover:border-brand-600 hover:bg-brand-50 border-line-strong bg-surface text-ink flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-sm"
            >
              {task.icon && <TaskIcon name={task.icon} />}
              {task.title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
