import { type SyntheticEvent, useEffect, useId, useRef, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import {
  describeReminder,
  MAX_REMINDER_AHEAD_MS,
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
  'text-brand-900 rounded-lg px-1 py-1.5 text-sm font-semibold underline-offset-2 hover:underline disabled:opacity-60';

/**
 * The user's reminder for a task that is theirs to do, with buttons to set, change or remove it. A
 * reminder is a push notification at the chosen time (ADR 0004).
 */
export function TaskReminder({ task, currentUserId }: TaskReminderProps) {
  const reminders = useReminders(currentUserId);
  const clearReminder = useClearReminder(currentUserId);
  // The datetime-local value being edited; null when the form is closed.
  const [draft, setDraft] = useState<string | null>(null);
  // Set when the form closes, so focus goes back to the button that opened it.
  const isReturningFocus = useRef(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const reminder = reminders.data?.find((candidate) => candidate.taskId === task.id);

  useEffect(() => {
    if (draft !== null || !isReturningFocus.current) return;
    isReturningFocus.current = false;
    openButton.current?.focus();
  }, [draft]);

  if (draft !== null) {
    return (
      <ReminderForm
        task={task}
        currentUserId={currentUserId}
        initialValue={draft}
        onClose={() => {
          isReturningFocus.current = true;
          setDraft(null);
        }}
      />
    );
  }
  if (reminders.isError) {
    return (
      <p role="alert" className="text-xs text-red-700">
        We couldn&apos;t load your reminder.
      </p>
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
            ref={openButton}
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
          ref={openButton}
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

/** Why the chosen time can't be used, if it can't. */
function invalidTimeMessage(remindAt: Date): string | null {
  const time = remindAt.getTime();
  if (Number.isNaN(time) || time <= Date.now()) return 'Pick a time in the future.';
  if (time > Date.now() + MAX_REMINDER_AHEAD_MS) return 'Pick a time within the next year.';
  return null;
}

function ReminderForm({ task, currentUserId, initialValue, onClose }: ReminderFormProps) {
  const inputId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const setReminder = useSetReminder(currentUserId);
  const [value, setValue] = useState(initialValue);
  const [invalidTime, setInvalidTime] = useState<string | null>(null);
  // Fixed while the form is open; the database has the final say.
  const [limits] = useState(() => {
    const now = new Date();
    return {
      min: toDateTimeLocal(now),
      max: toDateTimeLocal(new Date(now.getTime() + MAX_REMINDER_AHEAD_MS)),
    };
  });

  useEffect(() => {
    input.current?.focus();
  }, []);

  function save(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const remindAt = new Date(value);
    const message = invalidTimeMessage(remindAt);
    setInvalidTime(message);
    if (message) return;
    setReminder.mutate(
      { taskId: task.id, remindAt: remindAt.toISOString() },
      { onSuccess: onClose },
    );
  }

  const failure =
    invalidTime ?? (setReminder.isError ? "We couldn't save the reminder. Try again." : null);
  return (
    <form
      aria-label={`Reminder: ${task.title}`}
      onSubmit={save}
      noValidate
      className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 text-sm"
    >
      <label htmlFor={inputId} className="font-medium text-slate-900">
        Remind me at
      </label>
      <input
        ref={input}
        id={inputId}
        type="datetime-local"
        required
        min={limits.min}
        max={limits.max}
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
      {failure && (
        <p role="alert" className="text-xs text-red-700">
          {failure}
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
