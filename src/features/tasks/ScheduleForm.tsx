import { type SyntheticEvent, useEffect, useId, useRef, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import {
  atMinutes,
  durationChoices,
  MAX_SCHEDULE_DAYS_AWAY,
  type TaskSchedule,
} from '@/features/tasks/schedule';
import type { Task } from '@/features/tasks/task';
import { useClearSchedule, useSetSchedule } from '@/features/tasks/useSchedules';
import { addDays, daysBetween, toIsoDate, today } from '@/lib/dates';
import { type Messages, useMessages } from '@/lib/i18n/i18n';

interface ScheduleFormProps {
  task: Task;
  currentUserId: string;
  /** Where the block is now, or where a new one would go; `isScheduled` tells them apart. */
  initial: Pick<TaskSchedule, 'startsAt' | 'durationMinutes'>;
  isScheduled: boolean;
  onClose: () => void;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** The "HH:mm" a time input uses. */
function toTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Minutes into the day of an "HH:mm" time input's value, or null if it is empty. */
function fromTimeInput(value: string): number | null {
  const match = /^(\d\d):(\d\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Why the chosen day and time can't be used, if they can't. */
function invalidStartMessage(day: string, minutes: number | null, t: Messages): string | null {
  if (day === '' || minutes === null) return t.schedule.invalidStart;
  if (Math.abs(daysBetween(today(), day)) > MAX_SCHEDULE_DAYS_AWAY) return t.schedule.tooFar;
  return null;
}

/** When to do a task: its day, start and length, with buttons to save or take it off the timetable. */
export function ScheduleForm({
  task,
  currentUserId,
  initial,
  isScheduled,
  onClose,
}: ScheduleFormProps) {
  const ids = { day: useId(), start: useId(), length: useId() };
  const firstInput = useRef<HTMLInputElement>(null);
  const setSchedule = useSetSchedule(currentUserId);
  const clearSchedule = useClearSchedule(currentUserId);
  const startsAt = new Date(initial.startsAt);
  const [day, setDay] = useState(toIsoDate(startsAt));
  const [start, setStart] = useState(toTimeInput(startsAt));
  const [length, setLength] = useState(initial.durationMinutes);
  const [invalidStart, setInvalidStart] = useState<string | null>(null);
  const messages = useMessages();
  const t = messages.schedule;
  // Fixed while the form is open; the database has the final say.
  const [limits] = useState(() => ({
    min: addDays(today(), -MAX_SCHEDULE_DAYS_AWAY),
    max: addDays(today(), MAX_SCHEDULE_DAYS_AWAY),
  }));
  // A block made longer elsewhere keeps its length.
  const lengths = durationChoices.some((choice) => choice === initial.durationMinutes)
    ? durationChoices
    : [...durationChoices, initial.durationMinutes].sort((a, b) => a - b);

  useEffect(() => {
    firstInput.current?.focus();
  }, []);

  function save(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const minutes = fromTimeInput(start);
    const message = invalidStartMessage(day, minutes, messages);
    setInvalidStart(message);
    if (message || minutes === null) return;
    setSchedule.mutate(
      {
        taskId: task.id,
        startsAt: atMinutes(day, minutes).toISOString(),
        durationMinutes: length,
      },
      { onSuccess: onClose },
    );
  }

  const failure =
    invalidStart ??
    (setSchedule.isError ? t.saveFailed : clearSchedule.isError ? t.removeFailed : null);
  const fieldClassName = 'flex min-w-0 flex-col gap-1 font-medium text-ink';
  return (
    <form
      aria-label={t.formLabel(task.title)}
      onSubmit={save}
      noValidate
      className="bg-surface shadow-card flex flex-col gap-3 rounded-2xl p-4 text-sm"
    >
      <h3 className="text-ink font-semibold break-words">{task.title}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className={`${fieldClassName} col-span-2`}>
          <label htmlFor={ids.day}>{t.day}</label>
          <input
            ref={firstInput}
            id={ids.day}
            type="date"
            required
            min={limits.min}
            max={limits.max}
            value={day}
            onChange={(event) => {
              setDay(event.target.value);
            }}
            className={inputClassName}
          />
        </div>
        <div className={fieldClassName}>
          <label htmlFor={ids.start}>{t.start}</label>
          <input
            id={ids.start}
            type="time"
            required
            step={5 * 60}
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
            }}
            className={inputClassName}
          />
        </div>
        <div className={fieldClassName}>
          <label htmlFor={ids.length}>{t.length}</label>
          <select
            id={ids.length}
            value={length}
            onChange={(event) => {
              setLength(Number(event.target.value));
            }}
            className={inputClassName}
          >
            {lengths.map((minutes) => (
              <option key={minutes} value={minutes}>
                {t.duration(minutes)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {failure && (
        <p role="alert" className="text-danger-700 text-xs">
          {failure}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isScheduled && (
          <button
            type="button"
            disabled={clearSchedule.isPending}
            onClick={() => {
              clearSchedule.mutate(task.id, { onSuccess: onClose });
            }}
            className="text-danger-700 mr-auto rounded-lg px-1 py-1.5 font-semibold hover:underline disabled:opacity-60"
          >
            {t.remove}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="border-line-strong bg-surface text-ink hover:bg-page rounded-lg border px-3 py-1.5 font-semibold"
        >
          {messages.common.cancel}
        </button>
        <button
          type="submit"
          disabled={setSchedule.isPending}
          className="bg-brand-700 hover:bg-brand-900 rounded-xl px-3 py-1.5 font-bold text-white disabled:opacity-60"
        >
          {t.save}
        </button>
      </div>
    </form>
  );
}
