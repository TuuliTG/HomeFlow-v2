import type { Ref } from 'react';

import { ChevronDownIcon } from '@/components/ui/icons';

interface FormFoldButtonProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** The id of what it folds away. */
  controls: string;
  /** The id of the title, to name the section by. */
  titleId: string;
  title: string;
  /** How many items there are, if any, shown while folded too. */
  count?: number;
  buttonRef?: Ref<HTMLButtonElement>;
}

/** The heading of a list of tasks on the New task form, as a button that folds the list away and back. */
export function FormFoldButton({
  isOpen,
  onOpenChange,
  controls,
  titleId,
  title,
  count = 0,
  buttonRef,
}: FormFoldButtonProps) {
  return (
    <h2 className="text-ink text-sm font-medium">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={controls}
        onClick={() => {
          onOpenChange(!isOpen);
        }}
        className="hover:bg-surface -mx-2 flex min-h-11 items-center gap-2 rounded-xl px-2"
      >
        <span id={titleId}>{title}</span>
        {count > 0 && (
          <span className="bg-brand-50 text-brand-900 rounded-full px-2 text-xs">{count}</span>
        )}
        <ChevronDownIcon
          className={`text-ink-muted size-5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
    </h2>
  );
}
