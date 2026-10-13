import { daysBetween, today, toIsoDate } from '@/lib/dates';
import { type Messages, useMessages } from '@/lib/i18n/i18n';
import type { LastDone, Task } from '@/features/tasks/task';

type ByPerson = Messages['tasks']['card']['addedBy'];

/** "Added by you", by their name, or by "someone" if they haven't chosen a name or have deleted their account. */
function byPerson(
  phrases: ByPerson,
  person: { userId: string | null; name: string | null },
  currentUserId: string,
): string {
  if (person.userId === currentUserId) return phrases.you;
  return person.name === null ? phrases.someone : phrases.named(person.name);
}

/** Who added a task, who has picked it up, and who did it last time. */
export function TaskPeople({ task, currentUserId }: { task: Task; currentUserId: string }) {
  const t = useMessages().tasks.card;
  return (
    <>
      <span className="text-xs text-slate-500">
        {byPerson(t.addedBy, { userId: task.createdBy, name: task.creatorName }, currentUserId)}
      </span>
      {task.pickedUpBy !== null && (
        <span className="text-brand-900 text-xs font-medium">
          {byPerson(
            t.pickedUpBy,
            { userId: task.pickedUpBy, name: task.pickerName },
            currentUserId,
          )}
        </span>
      )}
      {task.lastDone !== null && (
        <LastDoneLine lastDone={task.lastDone} currentUserId={currentUserId} />
      )}
    </>
  );
}

/** "Last done by Ben, 3 days ago", counted in the user's local calendar days. */
function LastDoneLine({ lastDone, currentUserId }: { lastDone: LastDone; currentUserId: string }) {
  const t = useMessages().tasks.card;
  const days = Math.max(0, daysBetween(toIsoDate(new Date(lastDone.at)), today()));
  return (
    <span className="text-xs text-slate-500">
      {byPerson(
        t.lastDoneBy(t.daysAgo(days)),
        { userId: lastDone.by, name: lastDone.name },
        currentUserId,
      )}
    </span>
  );
}
