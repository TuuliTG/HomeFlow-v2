import { CheckboxField } from '@/features/tasks/CheckboxField';
import { TaskAudienceChoice } from '@/features/tasks/TaskAudienceChoice';
import { TaskChildrenField } from '@/features/tasks/TaskChildrenField';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskAudienceFieldsProps {
  /** Only a new task can be made private, or added for several children. */
  isNew: boolean;
  /** A child's tasks are always for children, so they are only asked whether to keep one private. */
  isChild: boolean;
  isPrivate: boolean;
  onPrivateChange: (isPrivate: boolean) => void;
  forChildren: boolean;
  onForChildrenChange: (forChildren: boolean) => void;
  /** The children whose chore it is; none for any child. */
  childIds: string[];
  onChildIdsChange: (childIds: string[]) => void;
  currentUserId: string;
}

/**
 * Who the task is for, at the top of the form: an adult chooses the adults, and whether to keep the task
 * private, or the children, and which of them (ADR 0004). A private task being edited stays the creator's.
 */
export function TaskAudienceFields({
  isNew,
  isChild,
  isPrivate,
  onPrivateChange,
  forChildren,
  onForChildrenChange,
  childIds,
  onChildIdsChange,
  currentUserId,
}: TaskAudienceFieldsProps) {
  const t = useMessages().taskForm;
  const keepPrivate = isNew && (
    <CheckboxField
      name="isPrivate"
      label={t.keepPrivate}
      checked={isPrivate}
      onChange={onPrivateChange}
    />
  );
  if (isChild) return keepPrivate;
  if (isPrivate && !isNew) return null;
  return (
    <>
      <TaskAudienceChoice forChildren={forChildren} onChange={onForChildrenChange} />
      {forChildren ? (
        <TaskChildrenField
          currentUserId={currentUserId}
          canChooseSeveral={isNew}
          value={childIds}
          onChange={onChildIdsChange}
        />
      ) : (
        keepPrivate
      )}
    </>
  );
}
