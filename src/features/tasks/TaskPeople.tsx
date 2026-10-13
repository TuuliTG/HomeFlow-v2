import { type Messages, useMessages } from '@/lib/i18n/i18n';
import type { Task } from '@/features/tasks/task';

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

/** Who added a task, and who has picked it up. */
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
    </>
  );
}
