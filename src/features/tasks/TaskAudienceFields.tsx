import { CheckboxField } from '@/features/tasks/CheckboxField';
import { TaskAssigneeField } from '@/features/tasks/TaskAssigneeField';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskAudienceFieldsProps {
  /** Only a new task can be made private. */
  canBePrivate: boolean;
  /** A child's tasks are always for children, so they aren't asked. */
  isChild: boolean;
  isPrivate: boolean;
  onPrivateChange: (isPrivate: boolean) => void;
  forChildren: boolean;
  onForChildrenChange: (forChildren: boolean) => void;
  assignedTo: string | null;
  onAssignedToChange: (assignedTo: string | null) => void;
  currentUserId: string;
}

/**
 * Who the task is for: kept private to its creator, or shared, and then whether children can do it, and if so
 * whether it is one child's chore.
 */
export function TaskAudienceFields({
  canBePrivate,
  isChild,
  isPrivate,
  onPrivateChange,
  forChildren,
  onForChildrenChange,
  assignedTo,
  onAssignedToChange,
  currentUserId,
}: TaskAudienceFieldsProps) {
  const t = useMessages().taskForm;
  return (
    <>
      {canBePrivate && (
        <CheckboxField
          name="isPrivate"
          label={t.keepPrivate}
          checked={isPrivate}
          onChange={onPrivateChange}
        />
      )}
      {!isPrivate && !isChild && (
        <CheckboxField
          name="forChildren"
          label={t.forChildren}
          checked={forChildren}
          onChange={onForChildrenChange}
        />
      )}
      {!isPrivate && !isChild && forChildren && (
        <TaskAssigneeField
          currentUserId={currentUserId}
          value={assignedTo}
          onChange={onAssignedToChange}
        />
      )}
    </>
  );
}
