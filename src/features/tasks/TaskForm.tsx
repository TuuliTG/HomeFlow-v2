import { type SyntheticEvent, useId, useRef, useState } from 'react';

import { paths } from '@/app/paths';
import { CancelLink } from '@/components/ui/CancelLink';
import { inputClassName } from '@/components/ui/formStyles';
import {
  DESCRIPTION_MAX_LENGTH,
  type NewTask,
  newTaskSchema,
  repeatChoices,
  type TaskSuggestion,
  type TaskType,
} from '@/features/tasks/task';
import type { TaskIconName } from '@/lib/taskIcons';
import { fieldValues, taskInput } from '@/features/tasks/taskFormValues';
import { type DraftImage, savedImages } from '@/features/tasks/taskImages';
import { TaskIconField } from '@/features/tasks/TaskIconField';
import { TaskImagesField } from '@/features/tasks/TaskImagesField';
import { suggestionAsTask } from '@/features/tasks/suggestions';
import { TaskAudienceFields } from '@/features/tasks/TaskAudienceFields';
import { TaskPointsField } from '@/features/tasks/TaskPointsField';
import { type FavouriteTasks, TaskTitleField } from '@/features/tasks/TaskTitleField';
import { TaskTypeField } from '@/features/tasks/TaskTypeField';
import { useMessages } from '@/lib/i18n/i18n';

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
  /** The pictures of the task being edited, by file name. */
  initialImages?: string[];
  /** A new task's starting details: an earlier task's to add it again, or ones from a link. */
  prefill?: NewTask | undefined;
  /** Tasks the household has added before, offered to add again; leave out when editing. */
  suggestions?: TaskSuggestion[];
  /** The household's favourite tasks, offered to add again; leave out when editing. */
  favourites?: FavouriteTasks;
  /** A child's tasks are always for children, and an adult awards their points, so they aren't asked. */
  isChild: boolean;
  currentUserId: string;
  submitLabel: string;
  isSaving: boolean;
  /** Saves the task and its pictures; a rejection shows "We couldn't save the task." */
  onSave: (task: NewTask, images: DraftImage[]) => Promise<void>;
}

/** The fields of a task, validated with `newTaskSchema`, for creating or editing one. */
export function TaskForm({
  initial,
  initialImages = [],
  prefill,
  suggestions = [],
  favourites,
  isChild,
  currentUserId,
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
  const [forChildren, setForChildren] = useState(initialValues.forChildren);
  const [icon, setIcon] = useState<TaskIconName | null>(initialValues.icon);
  const [assignedTo, setAssignedTo] = useState(initialValues.assignedTo);
  const [images, setImages] = useState(() => savedImages(initialImages));
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const t = useMessages();
  const errorId = useId();
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
    setForChildren(values.forChildren);
    setIcon(values.icon);
    setAssignedTo(values.assignedTo);
    setError(null);
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const values = { title, description, type, points, repeat: repeatEveryDays, dueOn };
    const parsed = newTaskSchema(t).safeParse(
      taskInput({ ...values, isPrivate, forChildren, icon, assignedTo }, isChild),
    );
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      const field = fieldOf(issue?.path[0]);
      setError({ field, message: issue?.message ?? t.taskForm.errors.checkDetails });
      fieldRefs[field].current?.focus();
      return;
    }
    onSave(parsed.data, images).catch(() => {
      setError({ field: null, message: t.taskForm.errors.saveFailed });
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
        favourites={favourites}
        inputRef={titleRef}
        errorProps={errorPropsFor('title')}
      />

      <label className="text-ink flex flex-col gap-1 text-sm font-medium">
        {t.taskForm.description}
        <textarea
          name="description"
          ref={descriptionRef}
          rows={2}
          maxLength={DESCRIPTION_MAX_LENGTH}
          {...errorPropsFor('description')}
          placeholder={t.taskForm.descriptionPlaceholder}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          className={inputClassName}
        />
      </label>

      <TaskImagesField
        images={images}
        onChange={(changed) => {
          setImages(changed);
          setError(null);
        }}
        onPreparingChange={setIsPreparingImages}
        currentUserId={currentUserId}
      />

      <TaskTypeField value={type} onChange={setType} />

      <TaskIconField value={icon} onChange={setIcon} />

      <TaskAudienceFields
        canBePrivate={!initial}
        isChild={isChild}
        isPrivate={isPrivate}
        onPrivateChange={setIsPrivate}
        forChildren={forChildren}
        onForChildrenChange={setForChildren}
        assignedTo={assignedTo}
        onAssignedToChange={setAssignedTo}
        currentUserId={currentUserId}
      />

      {!isPrivate && (
        <TaskPointsField
          isChild={isChild}
          value={points}
          onChange={setPoints}
          inputRef={pointsRef}
          errorProps={errorPropsFor('points')}
        />
      )}

      <div className="flex gap-3">
        <label className="text-ink flex flex-1 flex-col gap-1 text-sm font-medium">
          {t.taskForm.repeats}
          <select
            name="repeatEveryDays"
            value={repeatEveryDays}
            onChange={(event) => {
              setRepeatEveryDays(event.target.value);
            }}
            className={inputClassName}
          >
            <option value="">{t.taskForm.doesNotRepeat}</option>
            {repeatChoices.map((days) => (
              <option key={days} value={days}>
                {t.tasks.repeat(days)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-ink flex flex-1 flex-col gap-1 text-sm font-medium">
          {t.taskForm.dueDate}
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

      {error && (
        <p id={errorId} role="alert" className="text-danger-700 text-sm">
          {error.message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSaving || isPreparingImages}
          className="bg-brand-700 hover:bg-brand-900 flex-1 rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-60"
        >
          {submitLabel}
        </button>
        <CancelLink fallback={paths.taskList(initial?.isPrivate ?? false)} />
      </div>
    </form>
  );
}
