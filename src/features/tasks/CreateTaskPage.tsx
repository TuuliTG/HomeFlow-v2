import { type SyntheticEvent, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { paths } from '@/app/paths';
import { inputClassName } from '@/components/ui/formStyles';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  newTaskSchema,
  TITLE_MAX_LENGTH,
  type TaskType,
  taskTypeLabels,
  taskTypes,
} from '@/features/tasks/task';
import { useAddTask } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';

const DEFAULT_POINTS = '3';

interface FormError {
  /** The field to fix, or null when saving failed. */
  field: 'title' | 'points' | null;
  message: string;
}

export function CreateTaskPage() {
  const user = useLoggedInUser();
  const addTask = useAddTask(user.id);
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('physical');
  const [points, setPoints] = useState(DEFAULT_POINTS);
  const [error, setError] = useState<FormError | null>(null);
  const errorId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const pointsRef = useRef<HTMLInputElement>(null);

  function errorPropsFor(field: 'title' | 'points') {
    const hasError = error?.field === field;
    return { 'aria-invalid': hasError, 'aria-describedby': hasError ? errorId : undefined };
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const parsed = newTaskSchema.safeParse({ title, type, points });
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      const field = issue?.path[0] === 'points' ? 'points' : 'title';
      setError({ field, message: issue?.message ?? 'Check the task details.' });
      (field === 'points' ? pointsRef : titleRef).current?.focus();
      return;
    }
    addTask.mutate(parsed.data, {
      onSuccess: () => void navigate(paths.tasks),
      onError: () => {
        setError({ field: null, message: "We couldn't save the task. Try again." });
      },
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="New task"
        description="Adding a task is planning work, and it counts."
      />
      <form
        onSubmit={handleSubmit}
        onChange={() => {
          setError(null);
        }}
        className="flex flex-col gap-5"
        noValidate
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Task
          <input
            type="text"
            name="title"
            ref={titleRef}
            maxLength={TITLE_MAX_LENGTH}
            {...errorPropsFor('title')}
            placeholder="e.g. Take out the recycling"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            className={inputClassName}
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">Type</legend>
          <div className="flex gap-3">
            {taskTypes.map((option) => (
              <label
                key={option}
                className="has-checked:border-brand-600 has-checked:bg-brand-50 flex flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
              >
                <input
                  type="radio"
                  name="type"
                  value={option}
                  checked={type === option}
                  onChange={() => {
                    setType(option);
                  }}
                  className="accent-brand-600"
                />
                {taskTypeLabels[option]}
              </label>
            ))}
          </div>
        </fieldset>

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

        {error && (
          <p id={errorId} role="alert" className="text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={addTask.isPending}
            className="bg-brand-600 hover:bg-brand-900 flex-1 rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            Create task
          </button>
          <Link
            to={paths.tasks}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-center font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
