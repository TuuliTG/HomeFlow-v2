import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { AskedOfYou } from '@/features/tasks/AskedOfYou';
import { CompletedList } from '@/features/tasks/CompletedList';
import { TileSection } from '@/features/tasks/ChildTaskTiles';
import { sectionHeadingClassName } from '@/features/tasks/meStyles';
import { NewTaskLink } from '@/features/tasks/NewTaskLink';
import { isToDoBy } from '@/features/tasks/task';
import { useTasks } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

interface ChildMePageProps {
  /** The child's goals and how far they have come, at the top of the page. */
  goals: ReactNode;
}

/**
 * The Me page for a child: their goals, then their tasks as big tiles with icons and stars, with little
 * text, and what they have done.
 */
export function ChildMePage({ goals }: ChildMePageProps) {
  const t = useMessages().tasks;
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow={t.child.eyebrow} title={t.child.title} />
        <NewTaskLink />
      </div>
      <div className="flex flex-col gap-8">
        {goals}
        <AskedOfYou headingClassName={sectionHeadingClassName} />
        <ChildTasks />
        <section aria-labelledby="completed-heading" className="flex flex-col gap-3">
          <h2 id="completed-heading" className={sectionHeadingClassName}>
            {t.me.completed}
          </h2>
          <CompletedList />
        </section>
      </div>
    </>
  );
}

/** The child's tasks, to mark done; they pick tasks on Shared tasks, like adults. */
function ChildTasks() {
  const user = useLoggedInUser();
  const tasks = useTasks(user.id);
  const t = useMessages().tasks;

  // A failed refresh keeps showing the tasks already loaded.
  if (tasks.data === undefined) {
    if (!tasks.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.me.loadFailed}
      </p>
    );
  }
  return (
    <TileSection
      heading={t.child.myTasks}
      empty={
        <>
          {t.child.nothingToDo}{' '}
          <Link to={paths.tasks} className="text-brand-900 font-semibold underline">
            {t.child.pickOnBoard}
          </Link>
        </>
      }
      tasks={tasks.data.filter((task) => isToDoBy(task, user.id))}
      action="markDone"
    />
  );
}
