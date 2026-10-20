import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { TileSection } from '@/features/tasks/ChildTaskTiles';
import { NewTaskLink } from '@/features/tasks/NewTaskLink';
import { useTasks } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * The Shared tasks screen for a child, where they pick tasks like adults do: the tasks for children (the
 * only ones they see) as big tiles, free ones to pick up, theirs (done from the Me page), who is doing the
 * rest, then `completed`: the household's
 * done tasks on request. No filters, to keep it simple.
 */
export function ChildBoard({ completed }: { completed: ReactNode }) {
  const user = useLoggedInUser();
  const tasks = useTasks(user.id);
  const { common, tasks: t } = useMessages();

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
            action={null}
            note={() => (
              <Link to={paths.me} className="text-brand-900 underline">
                {t.childBoard.onYourMePage}
              </Link>
            )}
          />
          <TileSection
            heading={t.childBoard.othersDoing}
            tasks={tasks.data.filter(
              (task) => task.pickedUpBy !== null && task.pickedUpBy !== user.id,
            )}
            action={null}
            note={(task) => t.childBoard.doingIt(task.pickerName ?? common.someone)}
          />
        </div>
      )}
      {completed}
    </>
  );
}
