import { type SyntheticEvent, useId, useRef, useState } from 'react';

import { paths } from '@/app/paths';
import { CancelLink } from '@/components/ui/CancelLink';
import {
  NEW_TASK_DEFAULTS,
  type NewTask,
  newTaskSchema,
  type TaskSuggestion,
} from '@/features/tasks/task';
import {
  canBeRoutine,
  type FieldName,
  type FieldValues,
  fieldOf,
  fieldValues,
  shownFields,
  taskInput,
} from '@/features/tasks/taskFormValues';
import { TaskDescriptionField } from '@/features/tasks/TaskDescriptionField';
import { type DraftImage, savedImages } from '@/features/tasks/taskImages';
import { TaskIconField } from '@/features/tasks/TaskIconField';
import { TaskImagesField } from '@/features/tasks/TaskImagesField';
import { TaskLabelsField } from '@/features/tasks/TaskLabelsField';
import { suggestionAsTask } from '@/features/tasks/suggestions';
import { TaskAudienceFields } from '@/features/tasks/TaskAudienceFields';
import { TaskPointsField } from '@/features/tasks/TaskPointsField';
import { type FavouriteTasks, TaskTitleField } from '@/features/tasks/TaskTitleField';
import { TaskTimingFields } from '@/features/tasks/TaskTimingFields';
import { TaskTypeField } from '@/features/tasks/TaskTypeField';
import { useMessages } from '@/lib/i18n/i18n';

interface FormError {
  /** The field to fix, or null when saving failed. */
  field: FieldName | null;
  message: string;
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
  const [fields, setFields] = useState(initialValues);
  const [childIds, setChildIds] = useState(childIdsOf(initialValues.assignedTo));
  const [isDone, setIsDone] = useState(false);
  const [images, setImages] = useState(() => savedImages(initialImages));
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const t = useMessages();
  const errorId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const pointsRef = useRef<HTMLInputElement>(null);
  const repeatCountRef = useRef<HTMLInputElement>(null);
  const dueOnRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const fieldRefs = {
    title: titleRef,
    description: descriptionRef,
    points: pointsRef,
    repeatEveryDays: repeatCountRef,
    dueOn: dueOnRef,
  };

  function errorPropsFor(field: FieldName) {
    const hasError = error?.field === field;
    return { 'aria-invalid': hasError, 'aria-describedby': hasError ? errorId : undefined };
  }

  /** Changes some of the fields, e.g. `change({ dueOn: '' })`. */
  function change(changed: Partial<FieldValues>) {
    setFields((current) => ({ ...current, ...changed }));
  }

  /** Changes one field, e.g. `set('title')` as the title field's `onChange`. */
  function set<K extends keyof FieldValues>(key: K) {
    return (value: FieldValues[K]) => {
      setFields((current) => ({ ...current, [key]: value }));
    };
  }

  function fillIn(suggestion: TaskSuggestion) {
    const values = fieldValues(suggestionAsTask(suggestion));
    setFields(values);
    setChildIds(childIdsOf(values.assignedTo));
    setError(null);
  }

  /** A task done already has no due date. */
  function checkAlreadyDone(checked: boolean) {
    setIsDone(checked);
    if (checked) change({ dueOn: '' });
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
    change({ forChildren: isForChildren });
    if (!isForChildren) return;
    // Adults don't do tasks for children, so it can be neither private nor added as done.
    change({ isPrivate: false });
    setIsDone(false);
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const [assignedTo = null, ...alsoFor] = childIds;
    const parsed = newTaskSchema(t).safeParse(taskInput({ ...fields, assignedTo }, isChild));
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

  const { isPrivate, forChildren } = fields;
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
        onPrivateChange={set('isPrivate')}
        forChildren={shown.isForChildren}
        onForChildrenChange={chooseAudience}
        childIds={childIds}
        onChildIdsChange={setChildIds}
        currentUserId={currentUserId}
      />

      <TaskTitleField
        value={fields.title}
        onChange={set('title')}
        suggestions={suggestions}
        onPick={fillIn}
        favourites={favourites}
        inputRef={titleRef}
        errorProps={errorPropsFor('title')}
      />

      <TaskDescriptionField
        value={fields.description}
        onChange={set('description')}
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

      {shown.type && <TaskTypeField value={fields.type} onChange={set('type')} />}

      <TaskIconField value={fields.icon} onChange={set('icon')} />

      <TaskLabelsField
        value={{ labels: fields.labels, customLabels: fields.customLabels }}
        onChange={(changed) => {
          change(changed);
          setError(null);
        }}
        currentUserId={currentUserId}
      />

      {shown.points && (
        <TaskPointsField
          isChild={isChild}
          forChildren={shown.isForChildren}
          value={fields.points}
          onChange={set('points')}
          inputRef={pointsRef}
          errorProps={errorPropsFor('points')}
        />
      )}

      <TaskTimingFields
        repeat={fields.repeat}
        onRepeatChange={set('repeat')}
        repeatCountRef={repeatCountRef}
        repeatCountErrorProps={errorPropsFor('repeatEveryDays')}
        dueOn={fields.dueOn}
        onDueOnChange={set('dueOn')}
        dueOnRef={dueOnRef}
        dueOnErrorProps={errorPropsFor('dueOn')}
        alreadyDone={
          shown.alreadyDone ? { checked: isDone, onChange: checkAlreadyDone } : undefined
        }
        routine={{
          offered: canBeRoutine({ isChild, isPrivate, forChildren, repeat: fields.repeat }),
          checked: fields.isRoutine,
          onChange: set('isRoutine'),
        }}
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
