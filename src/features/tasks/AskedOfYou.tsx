import { TaskCard } from '@/features/tasks/TaskCard';
import { useTasks } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/** Tasks other members have asked the user to do, waiting for their answer; nothing when there are none. */
export function AskedOfYou({ headingClassName }: { headingClassName: string }) {
  const user = useLoggedInUser();
  const tasks = useTasks(user.id);
  const t = useMessages().tasks.requests;
  const asked = (tasks.data ?? []).filter(
    ({ request }) => request?.requestedFor === user.id && request.answer === null,
  );
  if (asked.length === 0) return null;
  return (
    <section aria-labelledby="asked-heading" className="flex flex-col gap-3">
      <h2 id="asked-heading" className={headingClassName}>
        {t.askedOfYou}
      </h2>
      <ul className="flex flex-col gap-3">
        {asked.map((task) => (
          <TaskCard key={task.id} task={task} currentUserId={user.id} titleLevel={3} />
        ))}
      </ul>
    </section>
  );
}
