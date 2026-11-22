import type { ReactNode } from 'react';

import { SwipeToDelete } from '@/components/ui/SwipeToDelete';
import { canChange, type Task } from '@/features/tasks/task';
import { useDeleteTask, useMembership } from '@/features/tasks/useTasks';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskSwipeToDeleteProps {
  task: Task;
  currentUserId: string;
  /** The card's shape and shadow (`SwipeToDelete`). */
  className: string;
  /** The card's background, padding and layout. */
  contentClassName: string;
  children: ReactNode;
}

/**
 * A task card that slides aside to show a delete button, for those who may change the task (as `EditLink`): it is
 * deleted at once, with a message when that fails. For others, just the card.
 */
export function TaskSwipeToDelete({
  task,
  currentUserId,
  className,
  contentClassName,
  children,
}: TaskSwipeToDeleteProps) {
  const membership = useMembership(currentUserId);
  const deleteTask = useDeleteTask(currentUserId);
  const { tasks, taskForm } = useMessages();
  // Not until it's known whether the user is a child.
  if (!canChange(task, currentUserId, membership.data?.isChild ?? true)) {
    return <div className={`${className} ${contentClassName}`}>{children}</div>;
  }
  return (
    <>
      <SwipeToDelete
        label={tasks.card.deleteLabel(task.title)}
        disabled={deleteTask.isPending}
        // A failure shows through isError.
        onDelete={() => deleteTask.mutateAsync(task)}
        className={className}
        contentClassName={contentClassName}
      >
        {children}
      </SwipeToDelete>
      {deleteTask.isError && (
        <p role="alert" className="text-danger-700 mt-2 text-sm">
          {taskForm.edit.deleteFailed}
        </p>
      )}
    </>
  );
}
