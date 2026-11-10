import { type SyntheticEvent, useId, useRef, useState } from 'react';

import { paths } from '@/app/paths';
import { CancelLink } from '@/components/ui/CancelLink';
import {
  NEW_TASK_DEFAULTS,
  type NewTask,
  newTaskSchema,
  type TaskSuggestion,
  type TaskType,
} from '@/features/tasks/task';
import type { TaskIconName } from '@/lib/taskIcons';
import { fieldValues, shownFields, taskInput } from '@/features/tasks/taskFormValues';
import { TaskDescriptionField } from '@/features/tasks/TaskDescriptionField';
import { type DraftImage, savedImages } from '@/features/tasks/taskImages';
import { TaskIconField } from '@/features/tasks/TaskIconField';
import { TaskImagesField } from '@/features/tasks/TaskImagesField';
import type { TaskLabels } from '@/features/tasks/taskLabelChoices';
import { TaskLabelsField } from '@/features/tasks/TaskLabelsField';
import { suggestionAsTask } from '@/features/tasks/suggestions';
import { TaskAudienceFields } from '@/features/tasks/TaskAudienceFields';
import { TaskPointsField } from '@/features/tasks/TaskPointsField';
import { type FavouriteTasks, TaskTitleField } from '@/features/tasks/TaskTitleField';
import { TaskTimingFields } from '@/features/tasks/TaskTimingFields';
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
  /** Offers to add the task as already done, which then has no due date. */
  canBeDoneAlready?: boolean;
  /**
   * Saves the task and its pictures, and says whether the user checked "Already done" and which other
   * children to add a copy for; a rejection shows "We couldn't save the task."
   */
  onSave: (task: NewTask, images: DraftImage[], options: SaveOptions) => Promise<void>;
}

export interface SaveOptions {
  isDone: boolean;
  /**
   * Further children to add the same task for, one copy each, when an adult adds a task for several
   * children; the task itself is the first child's.
   */
  alsoFor: string[];
}

/** The children a task for children is given to, as the form holds them: none for any child. */
function childIdsOf(assignedTo: string | null): string[] {
  return assignedTo === null ? [] : [assignedTo];
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
  canBeDoneAlready = false,
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
  const [childIds, setChildIds] = useState(childIdsOf(initialValues.assignedTo));
  const [labels, setLabels] = useState<TaskLabels>({
    labels: initialValues.labels,
    customLabels: initialValues.customLabels,
  });
  const [isDone, setIsDone] = useState(false);
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
    setChildIds(childIdsOf(values.assignedTo));
    setLabels({ labels: values.labels, customLabels: values.customLabels });
    setError(null);
  }

  /** A task done already has no due date. */
  function checkAlreadyDone(checked: boolean) {
    setIsDone(checked);
    if (checked) setDueOn('');
  }

  /** Says what to fix, focusing the field to fix it in. */
  function showInvalid(path: PropertyKey | undefined, message = t.taskForm.errors.checkDetails) {
    // Too many labels can only come from elsewhere (the field stops at the limit), so it names no field.
    const field = path === 'labels' ? null : fieldOf(path);
    setError({ field, message });
    if (field) fieldRefs[field].current?.focus();
  }

  /** Who the task is for, which an adult chooses first: then a task for children is the children's only. */
  function chooseAudience(isForChildren: boolean) {
    setForChildren(isForChildren);
    if (!isForChildren) return;
    // Adults don't do tasks for children, so it can be neither private nor added as done.
    setIsPrivate(false);
    setIsDone(false);
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const values = { title, description, type, points, repeat: repeatEveryDays, dueOn };
    const [assignedTo = null, ...alsoFor] = childIds;
    const parsed = newTaskSchema(t).safeParse(
      taskInput({ ...values, ...labels, isPrivate, forChildren, icon, assignedTo }, isChild),
    );
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      showInvalid(issue?.path[0], issue?.message);
      return;
    }
    const options = { isDone, alsoFor: parsed.data.assignedTo === null ? [] : alsoFor };
    onSave(parsed.data, images, options).catch(() => {
      setError({ field: null, message: t.taskForm.errors.saveFailed });
    });
  }

  const shown = shownFields({ isChild, isPrivate, forChildren, canBeDoneAlready });

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => {
        setError(null);
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      <TaskAudienceFields
        isNew={!initial}
        isChild={isChild}
        isPrivate={isPrivate}
        onPrivateChange={setIsPrivate}
        forChildren={shown.isForChildren}
        onForChildrenChange={chooseAudience}
        childIds={childIds}
        onChildIdsChange={setChildIds}
        currentUserId={currentUserId}
      />

      <TaskTitleField
        value={title}
        onChange={setTitle}
        suggestions={suggestions}
        onPick={fillIn}
        favourites={favourites}
        inputRef={titleRef}
        errorProps={errorPropsFor('title')}
      />

      <TaskDescriptionField
        value={description}
        onChange={setDescription}
        textareaRef={descriptionRef}
        errorProps={errorPropsFor('description')}
      />

      <TaskImagesField
        images={images}
        onChange={(changed) => {
          setImages(changed);
          setError(null);
        }}
        onPreparingChange={setIsPreparingImages}
        currentUserId={currentUserId}
      />

      {shown.type && <TaskTypeField value={type} onChange={setType} />}

      <TaskIconField value={icon} onChange={setIcon} />

      <TaskLabelsField
        value={labels}
        onChange={(changed) => {
          setLabels(changed);
          setError(null);
        }}
        currentUserId={currentUserId}
      />

      {shown.points && (
        <TaskPointsField
          isChild={isChild}
          forChildren={shown.isForChildren}
          value={points}
          onChange={setPoints}
          inputRef={pointsRef}
          errorProps={errorPropsFor('points')}
        />
      )}

      <TaskTimingFields
        repeat={repeatEveryDays}
        onRepeatChange={setRepeatEveryDays}
        dueOn={dueOn}
        onDueOnChange={setDueOn}
        dueOnRef={dueOnRef}
        dueOnErrorProps={errorPropsFor('dueOn')}
        alreadyDone={
          shown.alreadyDone ? { checked: isDone, onChange: checkAlreadyDone } : undefined
        }
      />

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
        <CancelLink fallback={paths.taskList(initial ?? NEW_TASK_DEFAULTS)} />
      </div>
    </form>
  );
}
