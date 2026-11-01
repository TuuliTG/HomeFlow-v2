import { type SyntheticEvent, useEffect, useId, useRef, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import {
  describeReminder,
  MAX_REMINDER_AHEAD_MS,
  suggestedReminderTime,
  toDateTimeLocal,
} from '@/features/tasks/reminder';
import type { Task } from '@/features/tasks/task';
import { useSchedules } from '@/features/tasks/useSchedules';
import { useClearReminder, useReminders, useSetReminder } from '@/features/tasks/useTasks';
import { type Messages, useMessages } from '@/lib/i18n/i18n';

interface TaskReminderProps {
  task: Task;
  currentUserId: string;
}

const linkButtonClassName =
  'text-brand-900 rounded-lg px-1 py-1.5 text-sm font-semibold underline-offset-2 hover:underline disabled:opacity-60';

/**
 * The user's reminder for a task that is theirs to do, with buttons to set, change or remove it. A
 * reminder is a push notification at the chosen time (ADR 0004); a new one starts half an hour before
 * the time the task is scheduled for, if any.
 */
export function TaskReminder({ task, currentUserId }: TaskReminderProps) {
  const reminders = useReminders(currentUserId);
  const schedules = useSchedules(currentUserId);
  const clearReminder = useClearReminder(currentUserId);
  // The datetime-local value being edited; null when the form is closed.
  const [draft, setDraft] = useState<string | null>(null);
  // Set when the form closes, so focus goes back to the button that opened it.
  const isReturningFocus = useRef(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const reminder = reminders.data?.find((candidate) => candidate.taskId === task.id);
  const schedule = schedules.data?.find((candidate) => candidate.taskId === task.id);
  const messages = useMessages();
  const t = messages.taskForm.reminder;

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
      <p role="alert" className="text-danger-700 text-xs">
        {t.loadFailed}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {reminder ? (
        <>
          <span className="text-ink mr-auto text-xs font-medium">
            {describeReminder(reminder.remindAt, new Date(), messages)}
          </span>
          <button
            ref={openButton}
            type="button"
            aria-label={t.changeLabel(task.title)}
            onClick={() => {
              setDraft(toDateTimeLocal(new Date(reminder.remindAt)));
            }}
            className={linkButtonClassName}
          >
            {t.change}
          </button>
          <button
            type="button"
            aria-label={t.removeLabel(task.title)}
            disabled={clearReminder.isPending}
            onClick={() => {
              clearReminder.mutate(task.id);
            }}
            className={linkButtonClassName}
          >
            {t.remove}
          </button>
        </>
      ) : (
        <button
          ref={openButton}
          type="button"
          aria-label={t.remindMeLabel(task.title)}
          disabled={reminders.isPending}
          onClick={() => {
            setDraft(suggestedReminderTime(new Date(), schedule?.startsAt));
          }}
          className={linkButtonClassName}
        >
          {t.remindMe}
        </button>
      )}
      {clearReminder.isError && (
        <p role="alert" className="text-danger-700 w-full text-xs">
          {t.removeFailed}
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
function invalidTimeMessage(remindAt: Date, t: Messages): string | null {
  const time = remindAt.getTime();
  if (Number.isNaN(time) || time <= Date.now()) return t.taskForm.reminder.pastTime;
  if (time > Date.now() + MAX_REMINDER_AHEAD_MS) return t.taskForm.reminder.tooFar;
  return null;
}

function ReminderForm({ task, currentUserId, initialValue, onClose }: ReminderFormProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const setReminder = useSetReminder(currentUserId);
  const [value, setValue] = useState(initialValue);
  const [invalidTime, setInvalidTime] = useState<string | null>(null);
  const messages = useMessages();
  const t = messages.taskForm.reminder;
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
    const message = invalidTimeMessage(remindAt, messages);
    setInvalidTime(message);
    if (message) return;
    setReminder.mutate(
      { taskId: task.id, remindAt: remindAt.toISOString() },
      { onSuccess: onClose },
    );
  }

  const failure = invalidTime ?? (setReminder.isError ? t.saveFailed : null);
  return (
    <form
      aria-label={t.formLabel(task.title)}
      onSubmit={save}
      noValidate
      className="bg-page flex flex-col gap-2 rounded-xl p-3 text-sm"
    >
      <label htmlFor={inputId} className="text-ink font-medium">
        {t.remindMeAt}
      </label>
      <input
        ref={input}
        id={inputId}
        type="datetime-local"
        required
        min={limits.min}
        max={limits.max}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        className={inputClassName}
      />
      {failure && (
        <p role="alert" className="text-danger-700 text-xs">
          {failure}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="border-line-strong bg-surface text-ink hover:bg-brand-50 rounded-xl border px-3 py-1.5 font-semibold"
        >
          {messages.common.cancel}
        </button>
        <button
          type="submit"
          disabled={setReminder.isPending}
          className="bg-brand-700 hover:bg-brand-900 rounded-xl px-3 py-1.5 font-bold text-white disabled:opacity-60"
        >
          {t.save}
        </button>
      </div>
    </form>
  );
}
