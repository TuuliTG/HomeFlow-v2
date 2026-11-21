import { useRef, useState } from 'react';

import { useHouseholdChildren } from '@/features/tasks/useHelpers';

/** The child a task for children is given to, as the form holds them: null when none is chosen yet. */
function childIdsOf(assignedTo: string | null): string[] | null {
  return assignedTo === null ? null : [assignedTo];
}

interface ChildChoiceOptions {
  /** Whether an adult is giving the task to the children, who then need choosing. */
  isForChildren: boolean;
  /** The child the task starts out given to, if any. */
  assignedTo: string | null;
}

/**
 * The children a task for children is given to: chosen children, the family's only child to begin with, and at
 * least one (ADR 0004). An edited task keeps its child unless another is chosen.
 */
export function useChildChoice(
  currentUserId: string,
  { isForChildren, assignedTo }: ChildChoiceOptions,
) {
  const children = useHouseholdChildren(currentUserId);
  const [chosen, setChosen] = useState(() => childIdsOf(assignedTo));
  const firstRef = useRef<HTMLInputElement>(null);
  const [onlyChild] = children.length === 1 ? children : [];
  const childIds = chosen ?? (onlyChild ? [onlyChild.id] : []);
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
     * Whether a task for children still needs a child chosen, unless the children are loading, when there is
     * nothing to choose from yet.
     */
    isMissing: isForChildren && childIds.length === 0 && children.length > 0,
  };
}
