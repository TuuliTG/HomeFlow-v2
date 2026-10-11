import { CheckboxField } from '@/features/tasks/CheckboxField';
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
}

/** Who the task is for: kept private to its creator, or shared, and then whether children can do it. */
export function TaskAudienceFields({
  canBePrivate,
  isChild,
  isPrivate,
  onPrivateChange,
  forChildren,
  onForChildrenChange,
}: TaskAudienceFieldsProps) {
  const t = useMessages().taskForm;
  return (
    <>
      {canBePrivate && (
        <CheckboxField
          name="isPrivate"
          label={t.keepPrivate}
          hint={t.privateHint}
          checked={isPrivate}
          onChange={onPrivateChange}
        />
      )}
      {!isPrivate && !isChild && (
        <CheckboxField
          name="forChildren"
          label={t.forChildren}
          hint={t.forChildrenHint}
          checked={forChildren}
          onChange={onForChildrenChange}
        />
      )}
    </>
  );
}
