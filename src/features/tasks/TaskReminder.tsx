import { type SyntheticEvent, useId, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import {
  describeReminder,
  suggestedReminderTime,
  toDateTimeLocal,
} from '@/features/tasks/reminder';
import type { Task } from '@/features/tasks/task';
import { useClearReminder, useReminders, useSetReminder } from '@/features/tasks/useTasks';

interface TaskReminderProps {
  task: Task;
  currentUserId: string;
}

const linkButtonClassName =
  'text-brand-900 rounded-lg px-1 py-1 text-sm font-semibold underline-offset-2 hover:underline disabled:opacity-60';

/**
 * The user's reminder for a task that is theirs to do, with buttons to set, change or remove it. A
 * reminder is a push notification at the chosen time (ADR 0004).
 */
export function TaskReminder({ task, currentUserId }: TaskReminderProps) {
  const reminders = useReminders(currentUserId);
  const clearReminder = useClearReminder(currentUserId);
  // The datetime-local value being edited; null when the form is closed.
  const [draft, setDraft] = useState<string | null>(null);
  const reminder = reminders.data?.find((candidate) => candidate.taskId === task.id);

  if (draft !== null) {
    return (
      <ReminderForm
        task={task}
        currentUserId={currentUserId}
        initialValue={draft}
        onClose={() => {
          setDraft(null);
        }}
      />
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {reminder ? (
        <>
          <span className="mr-auto text-xs font-medium text-slate-700">
            {describeReminder(reminder.remindAt, new Date())}
          </span>
          <button
            type="button"
            aria-label={`Change reminder: ${task.title}`}
            onClick={() => {
              setDraft(toDateTimeLocal(new Date(reminder.remindAt)));
            }}
            className={linkButtonClassName}
          >
            Change
          </button>
          <button
            type="button"
            aria-label={`Remove reminder: ${task.title}`}
            disabled={clearReminder.isPending}
            onClick={() => {
              clearReminder.mutate(task.id);
            }}
            className={linkButtonClassName}
          >
            Remove
          </button>
        </>
      ) : (
        <button
          type="button"
          aria-label={`Remind me: ${task.title}`}
          disabled={reminders.isPending}
          onClick={() => {
            setDraft(suggestedReminderTime(new Date()));
          }}
          className={linkButtonClassName}
        >
          Remind me
        </button>
      )}
      {clearReminder.isError && (
        <p role="alert" className="w-full text-xs text-red-700">
          We couldn&apos;t remove the reminder. Try again.
        </p>
      )}
    </div>
  );
}

interface ReminderFormProps extends TaskReminderProps {
  initialValue: string;
  onClose: () => void;
}

function ReminderForm({ task, currentUserId, initialValue, onClose }: ReminderFormProps) {
  const inputId = useId();
  const hintId = useId();
  const setReminder = useSetReminder(currentUserId);
  const [value, setValue] = useState(initialValue);
  const [isInPast, setIsInPast] = useState(false);

  function save(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const remindAt = new Date(value);
    if (Number.isNaN(remindAt.getTime()) || remindAt.getTime() <= Date.now()) {
      setIsInPast(true);
      return;
    }
    setIsInPast(false);
    setReminder.mutate(
      { taskId: task.id, remindAt: remindAt.toISOString() },
      { onSuccess: onClose },
    );
  }

  return (
    <form
      aria-label={`Reminder: ${task.title}`}
      onSubmit={save}
      className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 text-sm"
    >
      <label htmlFor={inputId} className="font-medium text-slate-900">
        Remind me at
      </label>
      <input
        id={inputId}
        type="datetime-local"
        required
        value={value}
        aria-describedby={hintId}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        className={inputClassName}
      />
      <p id={hintId} className="text-xs text-slate-600">
        You&apos;ll get a notification on each device where you&apos;ve turned notifications on.
      </p>
      {(isInPast || setReminder.isError) && (
        <p role="alert" className="text-xs text-red-700">
          {isInPast ? 'Pick a time in the future.' : "We couldn't save the reminder. Try again."}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={setReminder.isPending}
          className="bg-brand-600 hover:bg-brand-900 rounded-lg px-3 py-1.5 font-semibold text-white disabled:opacity-60"
        >
          Save reminder
        </button>
      </div>
    </form>
  );
}
