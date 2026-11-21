import { useRef, useState } from 'react';

import { useHouseholdChildren } from '@/features/tasks/useHelpers';

/** The child a task for children is given to, as the form holds them: null when none is chosen yet. */
function childIdsOf(assignedTo: string | null): string[] | null {
  return assignedTo === null ? null : [assignedTo];
}

interface ChildChoiceOptions {
  isNew: boolean;
  /** Whether an adult is giving the task to the children, who then need choosing. */
  isForChildren: boolean;
  /** The child the task starts out given to, if any. */
  assignedTo: string | null;
}

/**
 * The children a task for children is given to. A new task goes to chosen children, the family's only
 * child to begin with, and needs at least one; an edited task can be any child's (none chosen).
 */
export function useChildChoice(
  currentUserId: string,
  { isNew, isForChildren, assignedTo }: ChildChoiceOptions,
) {
  const children = useHouseholdChildren(currentUserId);
  const [chosen, setChosen] = useState(() => childIdsOf(assignedTo));
  const firstRef = useRef<HTMLInputElement>(null);
  const [onlyChild] = children.length === 1 ? children : [];
  const childIds = chosen ?? (isNew && onlyChild ? [onlyChild.id] : []);
  return {
    childIds,
    setChildIds: setChosen,
    /** The first child's tick box, to focus when none is ticked. */
    firstRef,
    /** Starts again from the child a task, e.g. a suggestion filled in, is given to. */
    reset: (taskAssignedTo: string | null) => {
      setChosen(childIdsOf(taskAssignedTo));
    },
    /**
     * Whether a new task for children still needs a child chosen; not without children to choose, nor while
     * they load, when the tick boxes aren't shown yet.
     */
    isMissing: isForChildren && isNew && children.length > 0 && childIds.length === 0,
  };
}
