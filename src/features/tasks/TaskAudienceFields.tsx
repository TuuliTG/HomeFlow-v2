import { LockIcon } from '@/components/ui/icons';
import { TaskAudienceChoice } from '@/features/tasks/TaskAudienceChoice';
import { useHouseholdChildren } from '@/features/tasks/useHelpers';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskAudienceFieldsProps {
  /** Only a new task can be made private. */
  isNew: boolean;
  /** A child's tasks are always for children, so they are only asked whether to keep one private. */
  isChild: boolean;
  isPrivate: boolean;
  onPrivateChange: (isPrivate: boolean) => void;
  forChildren: boolean;
  onForChildrenChange: (forChildren: boolean) => void;
  currentUserId: string;
}

/**
 * Who the task is for, at the top of the form: a new task can be made private first, which leaves nothing
 * more to choose; otherwise an adult in a family with children chooses the adults or the children (ADR 0004; not
 * when editing),
 * and a task for the children can't be private. A private task being edited stays the creator's.
 */
export function TaskAudienceFields({
  isNew,
  isChild,
  isPrivate,
  onPrivateChange,
  forChildren,
  onForChildrenChange,
  currentUserId,
}: TaskAudienceFieldsProps) {
  const hasChildren = useHouseholdChildren(currentUserId).length > 0;
  const privateToggle = isNew && <PrivateToggle pressed={isPrivate} onChange={onPrivateChange} />;
  if (isChild || isPrivate || !hasChildren || !isNew) return privateToggle;
  return (
    <>
      {!forChildren && privateToggle}
      <TaskAudienceChoice forChildren={forChildren} onChange={onForChildrenChange} />
    </>
  );
}

interface PrivateToggleProps {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
}

/** Makes a new task private, for its creator alone, or shared again. */
function PrivateToggle({ pressed, onChange }: PrivateToggleProps) {
  const t = useMessages().taskForm;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => {
        onChange(!pressed);
      }}
      className="border-line-strong bg-surface text-ink hover:bg-brand-50 aria-pressed:border-brand-600 aria-pressed:bg-brand-50 aria-pressed:text-brand-900 focus-visible:outline-brand-600 flex min-h-11 items-center gap-2 self-start rounded-full border px-4 text-sm font-medium focus-visible:outline-2"
    >
      <LockIcon className="size-4" />
      {t.privateTask}
    </button>
  );
}
