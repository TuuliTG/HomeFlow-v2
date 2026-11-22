import { type SyntheticEvent, useId, useState } from 'react';

import { type NewTask, type TaskSuggestion } from '@/features/tasks/task';
import {
  canBeRoutine,
  checkTask,
  type FieldName,
  fieldOf,
  fieldValues,
  type SaveOptions,
  shownFields,
  withReadyMadeTask,
} from '@/features/tasks/taskFormValues';
import { TaskDescriptionField } from '@/features/tasks/TaskDescriptionField';
import { TaskFormButtons } from '@/features/tasks/TaskFormButtons';
import { type DraftImage, savedImages } from '@/features/tasks/taskImages';
import { TaskIconField } from '@/features/tasks/TaskIconField';
import { TaskImagesField } from '@/features/tasks/TaskImagesField';
import { TaskLabelsField } from '@/features/tasks/TaskLabelsField';
import { useReadyMadeTasks } from '@/features/tasks/readyMadeTasks';
import { suggestionAsTask } from '@/features/tasks/suggestions';
import { TaskAudienceFields } from '@/features/tasks/TaskAudienceFields';
import { ChildPicker } from '@/features/tasks/ChildPicker';
import { TaskPointsField } from '@/features/tasks/TaskPointsField';
import { type FavouriteTasks, TaskTitleField } from '@/features/tasks/TaskTitleField';
import { ScheduleFields } from '@/features/tasks/TaskTimingFields';
import { TaskTypeField } from '@/features/tasks/TaskTypeField';
import { useTaskFieldRefs, useTaskFormFields } from '@/features/tasks/useTaskFormFields';
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
  /** The points a new task, or a ready-made one for adults, starts with (`useDefaultPoints`). */
  defaultPoints?: number;
  /** A child's tasks are always for children, and an adult awards their points, so they aren't asked. */
  isChild: boolean;
  /** Whether a private task being edited can be made shared (by default): a child's only while they may add tasks. */
  canShare?: boolean;
  currentUserId: string;
  submitLabel: string;
  isSaving: boolean;
  /** Offers to add the task as already done, which then has no due date. */
  canBeDoneAlready?: boolean;
  /**
   * Saves the task and its pictures, and says whether the user checked "Already done"; a rejection shows
   * "We couldn't save the task."
   */
  onSave: (task: NewTask, images: DraftImage[], options: SaveOptions) => Promise<void>;
}

/** The earlier tasks offered to add again: not an adult's for children, which the child's own form adds. */
function offeredSuggestions(suggestions: TaskSuggestion[], isChild: boolean): TaskSuggestion[] {
  return isChild ? suggestions : suggestions.filter((task) => !task.forChildren);
}

/**
 * A new task can be made private, and a private one shared (`canShare`); a shared task can't be made private.
 */
function canBePrivate(initial: NewTask | undefined, canShare: boolean | undefined): boolean {
  return !initial || (initial.isPrivate && canShare !== false);
}

/**
 * The fields of a task, validated with `newTaskSchema`, for creating or editing one. An adult adding a task for the
 * children picks a child instead, whose own form then opens (`ChildPicker`, ADR 0004).
 */
export function TaskForm({
  initial,
  initialImages = [],
  prefill,
  suggestions = [],
  favourites,
  defaultPoints,
  isChild,
  canShare,
  currentUserId,
  submitLabel,
  isSaving,
  canBeDoneAlready = false,
  onSave,
}: TaskFormProps) {
  const [initialValues] = useState(() => fieldValues(initial ?? prefill, defaultPoints));
  const { fields, setFields, change, set } = useTaskFormFields(initialValues);
  const { isPrivate, forChildren } = fields;
  const shown = shownFields({
    isChild,
    isPrivate,
    forChildren,
    canBeDoneAlready,
    isAlways: fields.isAlways,
    isRoutine: fields.isRoutine,
  });
  const earlier = offeredSuggestions(suggestions, isChild);
  const readyMade = useReadyMadeTasks({
    isNew: !initial,
    isForChildren: isChild,
    isPrivate,
    defaultPoints,
    earlier,
  });
  const [isDone, setIsDone] = useState(false);
  const [images, setImages] = useState(() => savedImages(initialImages));
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const t = useMessages();
  const errorId = useId();
  const fieldRefs = useTaskFieldRefs();

  function errorPropsFor(field: FieldName) {
    const hasError = error?.field === field;
    return { 'aria-invalid': hasError, 'aria-describedby': hasError ? errorId : undefined };
  }

  /** Fills in an earlier task's details, or a ready-made task's while keeping who it is for (and the rest). */
  function fillIn(suggestion: TaskSuggestion) {
    setError(null);
    if (readyMade.includes(suggestion)) {
      setFields((current) => withReadyMadeTask(current, suggestion));
      return;
    }
    setFields(fieldValues(suggestionAsTask(suggestion), defaultPoints));
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

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const parsed = checkTask(fields, isChild, t);
    if (!parsed.success) {
      showInvalid(parsed.path, parsed.message);
      return;
    }
    // The check mark keeps its value while hidden, so it counts only while shown.
    onSave(parsed.data, images, { isDone: isDone && shown.alreadyDone }).catch(() => {
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
      <TaskAudienceFields
        isNew={!initial}
        canBePrivate={canBePrivate(initial, canShare)}
        isChild={isChild}
        isPrivate={isPrivate}
        onPrivateChange={set('isPrivate')}
        forChildren={shown.isForChildren}
        onForChildrenChange={set('forChildren')}
        routine={{
          offered: canBeRoutine({ isChild, isPrivate, forChildren }),
          pressed: fields.isRoutine,
          onChange: set('isRoutine'),
        }}
        currentUserId={currentUserId}
      />
      {shown.isForChildren ? (
        <ChildPicker currentUserId={currentUserId} />
      ) : (
        <>
          <TaskTitleField
            value={fields.title}
            onChange={set('title')}
            suggestions={earlier}
            readyMade={readyMade}
            onPick={fillIn}
            favourites={favourites}
            inputRef={fieldRefs.title}
            errorProps={errorPropsFor('title')}
          />

          <TaskDescriptionField
            value={fields.description}
            onChange={set('description')}
            textareaRef={fieldRefs.description}
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
              value={fields.points}
              onChange={set('points')}
              inputRef={fieldRefs.points}
              errorProps={errorPropsFor('points')}
            />
          )}

          {shown.schedule && (
            <ScheduleFields
              repeat={fields.repeat}
              onRepeatChange={set('repeat')}
              repeatCountRef={fieldRefs.repeatEveryDays}
              repeatCountErrorProps={errorPropsFor('repeatEveryDays')}
              dueOn={fields.dueOn}
              onDueOnChange={set('dueOn')}
              dueOnRef={fieldRefs.dueOn}
              dueOnErrorProps={errorPropsFor('dueOn')}
              alreadyDone={{
                offered: shown.alreadyDone,
                checked: isDone,
                onChange: checkAlreadyDone,
              }}
            />
          )}

          {error && (
            <p id={errorId} role="alert" className="text-danger-700 text-sm">
              {error.message}
            </p>
          )}

          <TaskFormButtons
            submitLabel={submitLabel}
            disabled={isSaving || isPreparingImages}
            initial={initial}
          />
        </>
      )}
    </form>
  );
}
