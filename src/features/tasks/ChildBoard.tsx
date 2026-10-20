import type { ReactNode } from 'react';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { TileSection } from '@/features/tasks/ChildTaskTiles';
import { NewTaskLink } from '@/features/tasks/NewTaskLink';
import { useTasks } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * The Shared tasks screen for a child: the tasks for children (the only ones they see) as big tiles, free
 * ones to pick up, their own to mark done, and who is doing the rest, then `completed`: the household's
 * done tasks on request. No filters, to keep it simple.
 */
export function ChildBoard({ completed }: { completed: ReactNode }) {
  const user = useLoggedInUser();
  const tasks = useTasks(user.id);
  const t = useMessages().tasks;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow={t.eyebrow}
          title={t.childBoard.title}
          description={t.childBoard.description}
        />
        <NewTaskLink />
      </div>
      {tasks.data === undefined ? (
        // A failed refresh keeps showing the tasks already loaded.
        tasks.isError ? (
          <p role="alert" className="text-danger-700 text-sm">
            {t.board.loadFailed}
          </p>
        ) : (
          <LoadingMessage />
        )
      ) : (
        <div className="flex flex-col gap-8">
          <TileSection
            heading={t.childBoard.free}
            empty={t.childBoard.nothingFree}
            tasks={tasks.data.filter((task) => !task.isPrivate && task.pickedUpBy === null)}
            action="pickUp"
          />
          <TileSection
            heading={t.childBoard.yours}
            tasks={tasks.data.filter((task) => !task.isPrivate && task.pickedUpBy === user.id)}
            action="markDone"
          />
          <TileSection
            heading={t.childBoard.othersDoing}
            tasks={tasks.data.filter(
              (task) => task.pickedUpBy !== null && task.pickedUpBy !== user.id,
            )}
            action={null}
          />
        </div>
      )}
      {completed}
    </>
  );
}
