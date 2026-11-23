import type { ReactNode } from 'react';

import { FlagIcon, LockIcon, RepeatIcon } from '@/components/ui/icons';
import { TaskAudienceChoice } from '@/features/tasks/TaskAudienceChoice';
import { useHouseholdChildren } from '@/features/tasks/useHelpers';
import { useMessages } from '@/lib/i18n/i18n';

interface Toggle {
  offered: boolean;
  pressed: boolean;
  onChange: (pressed: boolean) => void;
}

interface TaskAudienceFieldsProps {
  isNew: boolean;
  /** A new task can be made private, and a private one shared; a shared task can't be made private. */
  canBePrivate: boolean;
  /** A child's tasks are always for children, so they are only asked whether to keep one private. */
  isChild: boolean;
  isPrivate: boolean;
  onPrivateChange: (isPrivate: boolean) => void;
  forChildren: boolean;
  onForChildrenChange: (forChildren: boolean) => void;
  /** Whether it is a routine, offered for the adults' shared tasks (`canBeRoutine()`). */
  routine: Toggle;
  /** Whether it is a priority, offered for the adults' shared tasks that aren't routines (`canBePriority()`). */
  priority: Toggle;
  currentUserId: string;
}

/**
 * Who the task is for, at the top of the form: a new task can be made private first, which leaves nothing
 * more to choose; otherwise an adult in a family with children chooses the adults or the children (ADR 0004; not
 * when editing),
 * and a task for the children can't be private. A private task being edited can be made shared, with the family
 * it was for: an adult's with the adults, a child's as their own chore. Beside "Private", an adults' shared task can
 * be made a routine, which is always available, or a priority, listed at the top of the board.
 */
export function TaskAudienceFields({
  isNew,
  canBePrivate,
  isChild,
  isPrivate,
  onPrivateChange,
  forChildren,
  onForChildrenChange,
  routine,
  priority,
  currentUserId,
}: TaskAudienceFieldsProps) {
  const t = useMessages().taskForm;
  const hasChildren = useHouseholdChildren(currentUserId).length > 0;
  const offered = [
    {
      toggle: { offered: canBePrivate, pressed: isPrivate, onChange: onPrivateChange },
      icon: <LockIcon className="size-4" />,
      label: t.privateTask,
    },
    { toggle: routine, icon: <RepeatIcon className="size-4" />, label: t.routine },
    { toggle: priority, icon: <FlagIcon className="size-4" />, label: t.priority },
  ].filter(({ toggle }) => toggle.offered);
  const toggles = offered.length > 0 && (
    <div className="flex flex-wrap gap-2">
      {offered.map(({ toggle, icon, label }) => (
        <TogglePill key={label} pressed={toggle.pressed} onChange={toggle.onChange} icon={icon}>
          {label}
        </TogglePill>
      ))}
    </div>
  );
  if (isChild || isPrivate || !hasChildren || !isNew) return toggles;
  return (
    <>
      {!forChildren && toggles}
      <TaskAudienceChoice forChildren={forChildren} onChange={onForChildrenChange} />
    </>
  );
}

interface TogglePillProps {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  icon: ReactNode;
  children: ReactNode;
}

/** A pill that switches a choice about the task on or off, like making a new task private. */
function TogglePill({ pressed, onChange, icon, children }: TogglePillProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => {
        onChange(!pressed);
      }}
      className="border-line-strong bg-surface text-ink hover:bg-brand-50 aria-pressed:border-brand-600 aria-pressed:bg-brand-50 aria-pressed:text-brand-900 focus-visible:outline-brand-600 flex min-h-11 items-center gap-2 self-start rounded-full border px-4 text-sm font-medium focus-visible:outline-2"
    >
      {icon}
      {children}
    </button>
  );
}
