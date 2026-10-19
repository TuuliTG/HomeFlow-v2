import { describeDueDate, type DueStatus, dueStatus } from '@/features/tasks/dueDate';
import { today } from '@/lib/dates';
import { useMessages } from '@/lib/i18n/i18n';

const dueClassNames: Record<DueStatus, string> = {
  overdue: 'bg-overdue-100 text-overdue-800',
  today: 'bg-due-today-100 text-due-today-800',
  upcoming: 'bg-page text-ink-muted',
};

/** "Due today", "Was due Mon 6 Oct"…, coloured by whether it has passed or is today. */
export function TaskDueDate({ dueOn }: { dueOn: string }) {
  const t = useMessages();
  const todayDate = today();
  return (
    <span
      className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-bold ${dueClassNames[dueStatus(dueOn, todayDate)]}`}
    >
      {describeDueDate(dueOn, todayDate, t)}
    </span>
  );
}
