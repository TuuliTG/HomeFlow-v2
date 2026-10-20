import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { AskedOfYou } from '@/features/tasks/AskedOfYou';
import { CompletedList } from '@/features/tasks/CompletedList';
import { DueTaskGroups } from '@/features/tasks/DueTaskGroups';
import { emptyClassName, sectionHeadingClassName } from '@/features/tasks/meStyles';
import { NewTaskLink } from '@/features/tasks/NewTaskLink';
import { parseToDoView, type ToDoView, toDoViews } from '@/features/tasks/schedule';
import { ScheduleView } from '@/features/tasks/ScheduleView';
import { isToDoBy } from '@/features/tasks/task';
import { useTasks, useTotalPoints } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';
import { useSearchParam } from '@/lib/useSearchParam';

export function MyTasksPage() {
  const { tasks, schedule } = useMessages();
  const t = tasks.me;
  const user = useLoggedInUser();
  const [view, setView] = useSearchParam<ToDoView>({
    name: 'view',
    parse: parseToDoView,
    serialise: (chosen) => (chosen === 'list' ? null : chosen),
    rememberAs: `me.view:${user.id}`,
  });
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
        <NewTaskLink />
      </div>
      <div className="flex flex-col gap-8">
        <PointsTotal />
        <AskedOfYou headingClassName={sectionHeadingClassName} />
        <section aria-labelledby="to-do-heading" className="flex flex-col gap-3">
          <h2 id="to-do-heading" className={sectionHeadingClassName}>
            {t.toDo}
          </h2>
          <SegmentedChoice
            legend={schedule.viewLegend}
            options={toDoViews}
            labels={schedule.views}
            value={view}
            onChange={setView}
          />
          <ToDoList view={view} />
        </section>
        <section aria-labelledby="completed-heading" className="flex flex-col gap-3">
          <h2 id="completed-heading" className={sectionHeadingClassName}>
            {t.completed}
          </h2>
          <CompletedList />
        </section>
      </div>
    </>
  );
}

function PointsTotal() {
  const user = useLoggedInUser();
  const points = useTotalPoints(user.id);
  const t = useMessages().tasks.me;

  return (
    <section
      aria-labelledby="points-heading"
      className="bg-brand-900 shadow-hero flex flex-col gap-1 rounded-3xl p-5 text-white"
    >
      <h2 id="points-heading" className="text-brand-100 text-sm font-semibold">
        {t.pointsEarned}
      </h2>
      {points.data !== undefined ? (
        <span className="text-5xl leading-none font-extrabold tracking-tight">{points.data}</span>
      ) : points.isError ? (
        <p role="alert" className="text-sm font-semibold">
          {t.pointsLoadFailed}
        </p>
      ) : (
        <LoadingMessage className="text-brand-100" />
      )}
    </section>
  );
}

function ToDoList({ view }: { view: ToDoView }) {
  const user = useLoggedInUser();
  const tasks = useTasks(user.id);
  const t = useMessages().tasks.me;

  // A failed refresh keeps showing the tasks already loaded.
  if (tasks.data === undefined) {
    if (!tasks.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.loadFailed}
      </p>
    );
  }
  const mine = tasks.data.filter((task) => isToDoBy(task, user.id));
  // The timetable shows even without tasks: a new one can be added from it.
  if (view !== 'list') return <ScheduleView view={view} tasks={mine} currentUserId={user.id} />;
  if (mine.length === 0) {
    return <p className={emptyClassName}>{t.nothingPickedUp}</p>;
  }
  return <DueTaskGroups tasks={mine} currentUserId={user.id} headingLevel={3} />;
}
