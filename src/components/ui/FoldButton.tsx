import type { ReactNode } from 'react';

import { ChevronDownIcon } from '@/components/ui/icons';

interface FoldButtonProps {
  folded: boolean;
  onFoldedChange: (folded: boolean) => void;
  /** The id of what it folds away. */
  controls: string;
  /** How many items there are, shown even while folded so they aren't forgotten. */
  count: number;
  /** The count's colours, e.g. `bg-overdue-100`. */
  countClassName: string;
  /** The section's name, as its heading shows it. */
  children: ReactNode;
}

/** A section heading's button that folds the section's items away and back, to save room on a phone. */
export function FoldButton({
  folded,
  onFoldedChange,
  controls,
  count,
  countClassName,
  children,
}: FoldButtonProps) {
  return (
    <button
      type="button"
      aria-expanded={!folded}
      aria-controls={controls}
      onClick={() => {
        onFoldedChange(!folded);
      }}
      className="hover:bg-surface -mx-2 flex min-h-11 items-center gap-2 rounded-xl px-2 uppercase"
    >
      {children}
      <span className={`rounded-full px-2 text-xs ${countClassName}`}>{count}</span>
      <ChevronDownIcon
        className={`size-5 shrink-0 transition-transform ${folded ? '' : 'rotate-180'}`}
      />
    </button>
  );
}
