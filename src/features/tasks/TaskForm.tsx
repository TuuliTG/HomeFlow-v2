import { type SyntheticEvent, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { inputClassName } from '@/components/ui/formStyles';
import {
  DESCRIPTION_MAX_LENGTH,
  type NewTask,
  newTaskSchema,
  repeatChoices,
  repeatLabel,
  type TaskSuggestion,
  type TaskType,
} from '@/features/tasks/task';
import { PrivateTaskField } from '@/features/tasks/PrivateTaskField';
import { suggestionAsTask } from '@/features/tasks/suggestions';
import { TaskTitleField } from '@/features/tasks/TaskTitleField';
import { TaskTypeField } from '@/features/tasks/TaskTypeField';

const DEFAULT_POINTS = '3';

type FieldName = 'title' | 'description' | 'points' | 'dueOn';

interface FormError {
  /** The field to fix, or null when saving failed. */
  field: FieldName | null;
  message: string;
}

function fieldOf(path: PropertyKey | undefined): FieldName {
  return path === 'description' || path === 'points' || path === 'dueOn' ? path : 'title';
}

interface TaskFormProps {
  /** The task being edited; a new task starts empty and can be made private. */
  initial?: NewTask;
  /** A new task's starting details, e.g. an earlier task's to add it again. */
  prefill?: NewTask | undefined;
  /** Tasks the household has added before, offered to add again; leave out when editing. */
  suggestions?: TaskSuggestion[];
  submitLabel: string;
  isSaving: boolean;
  /** Saves the task; a rejection shows "We couldn't save the task." */
  onSave: (task: NewTask) => Promise<void>;
}

/** The form's field values (strings, as inputs hold them) for a task, or for a new one. */
function fieldValues(task: NewTask | undefined) {
  if (!task)
    return {
      title: '',
      description: '',
      type: 'physical' as TaskType,
      points: DEFAULT_POINTS,
      repeat: '',
      dueOn: '',
      isPrivate: false,
    };
  return {
    title: task.title,
    description: task.description ?? '',
    type: task.type,
    points: task.points === null ? DEFAULT_POINTS : String(task.points),
    repeat: task.repeatEveryDays === null ? '' : String(task.repeatEveryDays),
    dueOn: task.dueOn ?? '',
    isPrivate: task.isPrivate,
  };
}

/** The fields of a task, validated with `newTaskSchema`, for creating or editing one. */
export function TaskForm({
  initial,
  prefill,
  suggestions = [],
  submitLabel,
  isSaving,
  onSave,
}: TaskFormProps) {
  const [initialValues] = useState(() => fieldValues(initial ?? prefill));
  const [title, setTitle] = useState(initialValues.title);
  const [description, setDescription] = useState(initialValues.description);
  const [type, setType] = useState<TaskType>(initialValues.type);
  const [points, setPoints] = useState(initialValues.points);
  /** Days between occurrences, or '' for a one-off task. */
  const [repeatEveryDays, setRepeatEveryDays] = useState(initialValues.repeat);
  const [dueOn, setDueOn] = useState(initialValues.dueOn);
  const [isPrivate, setIsPrivate] = useState(initialValues.isPrivate);
  const [error, setError] = useState<FormError | null>(null);
  const errorId = useId();
  const repeatHintId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const pointsRef = useRef<HTMLInputElement>(null);
  const dueOnRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const fieldRefs = {
    title: titleRef,
    description: descriptionRef,
    points: pointsRef,
    dueOn: dueOnRef,
  };

  function errorPropsFor(field: FieldName) {
    const hasError = error?.field === field;
    return { 'aria-invalid': hasError, 'aria-describedby': hasError ? errorId : undefined };
  }

  function fillIn(suggestion: TaskSuggestion) {
    const values = fieldValues(suggestionAsTask(suggestion));
    setTitle(values.title);
    setDescription(values.description);
    setType(values.type);
    setPoints(values.points);
    setRepeatEveryDays(values.repeat);
    setDueOn(values.dueOn);
    setIsPrivate(values.isPrivate);
    setError(null);
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const parsed = newTaskSchema.safeParse({
      title,
      type,
      points: isPrivate ? null : points,
      repeatEveryDays: repeatEveryDays === '' ? null : Number(repeatEveryDays),
      dueOn: dueOn === '' ? null : dueOn,
      description: description.trim() === '' ? null : description,
      isPrivate,
    });
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      const field = fieldOf(issue?.path[0]);
      setError({ field, message: issue?.message ?? 'Check the task details.' });
      fieldRefs[field].current?.focus();
      return;
    }
    onSave(parsed.data).catch(() => {
      setError({ field: null, message: "We couldn't save the task. Try again." });
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => {
        setError(null);
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      <TaskTitleField
        value={title}
        onChange={setTitle}
        suggestions={suggestions}
        onPick={fillIn}
        inputRef={titleRef}
        errorProps={errorPropsFor('title')}
      />

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Description (optional)
        <textarea
          name="description"
          ref={descriptionRef}
          rows={2}
          maxLength={DESCRIPTION_MAX_LENGTH}
          {...errorPropsFor('description')}
          placeholder="e.g. The bins are behind the garage"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          className={inputClassName}
        />
      </label>

      <TaskTypeField value={type} onChange={setType} />

      {!initial && <PrivateTaskField checked={isPrivate} onChange={setIsPrivate} />}

      {!isPrivate && (
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Points
          <input
            type="number"
            name="points"
            ref={pointsRef}
            {...errorPropsFor('points')}
            inputMode="numeric"
            min={1}
            max={10}
            value={points}
            onChange={(event) => {
              setPoints(event.target.value);
            }}
            className={`${inputClassName} w-24`}
          />
        </label>
      )}

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          Repeats
          <select
            name="repeatEveryDays"
            aria-describedby={repeatEveryDays === '' ? undefined : repeatHintId}
            value={repeatEveryDays}
            onChange={(event) => {
              setRepeatEveryDays(event.target.value);
            }}
            className={inputClassName}
          >
            <option value="">Doesn&apos;t repeat</option>
            {repeatChoices.map((days) => (
              <option key={days} value={days}>
                {repeatLabel(days)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          Due date
          <input
            type="date"
            name="dueOn"
            ref={dueOnRef}
            {...errorPropsFor('dueOn')}
            value={dueOn}
            onChange={(event) => {
              setDueOn(event.target.value);
            }}
            className={`${inputClassName} min-w-0`}
          />
        </label>
      </div>
      {repeatEveryDays !== '' && (
        <p id={repeatHintId} className="-mt-3 text-sm text-slate-600">
          Each time it&apos;s done, it comes back{' '}
          {Number(repeatEveryDays) === 1 ? '1 day' : `${repeatEveryDays} days`} later.
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-700">
          {error.message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-brand-600 hover:bg-brand-900 flex-1 rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {submitLabel}
        </button>
        <Link
          to={paths.tasks}
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-center font-semibold text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
