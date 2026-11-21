import { useId, useState } from 'react';

import { TaskIcon } from '@/components/ui/TaskIcon';
import { taskChipClassName } from '@/features/tasks/chipStyles';
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
              className={`${taskChipClassName} flex items-center gap-2`}
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
