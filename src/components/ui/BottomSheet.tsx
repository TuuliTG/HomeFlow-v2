import { type ReactNode, useEffect, useEffectEvent, useId, useRef } from 'react';

import { CloseIcon } from '@/components/ui/icons';
import { useMessages } from '@/lib/i18n/i18n';

interface BottomSheetProps {
  /** The sheet's heading, which also names it. */
  title: ReactNode;
  onClose: () => void;
  /** What takes the focus on closing when what opened the sheet is gone, e.g. after deleting it. */
  fallbackFocus?: () => HTMLElement | null | undefined;
  children: ReactNode;
}

/**
 * A modal popup that rises from the bottom on phones and sits in the middle on wider screens: a native `<dialog>`,
 * so the page behind it is inert and Escape closes it, as do the close button and a tap outside it. Its first
 * control takes the focus, which goes back to what opened it when it closes.
 */
export function BottomSheet({ title, onClose, fallbackFocus, children }: BottomSheetProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fallbackFocusRef = useRef(fallbackFocus);
  const t = useMessages().common;
  // Not an onClick on the dialog, which isn't a control: a tap on the backdrop is a click on the dialog itself,
  // as its content fills it.
  const closeOnBackdropClick = useEffectEvent((event: MouseEvent) => {
    if (event.target === dialogRef.current) onClose();
  });

  useEffect(() => {
    fallbackFocusRef.current = fallbackFocus;
  });

  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    dialog?.addEventListener('click', closeOnBackdropClick);
    // Not the close button, which comes first.
    contentRef.current?.querySelector<HTMLElement>('button:not([disabled]), a[href]')?.focus();
    return () => {
      dialog?.removeEventListener('click', closeOnBackdropClick);
      dialog?.close();
      const returnTo =
        opener instanceof HTMLElement && opener.isConnected ? opener : fallbackFocusRef.current?.();
      returnTo?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="bg-surface shadow-card backdrop:bg-ink/40 mx-auto mt-auto mb-0 w-full max-w-none rounded-t-3xl md:my-auto md:max-w-md md:rounded-3xl"
    >
      <div className="flex flex-col gap-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-4">
        <div className="flex items-center gap-2">
          <h2 id={titleId} className="text-ink flex min-w-0 flex-1 items-center gap-2 font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="text-ink-muted hover:bg-page flex size-11 shrink-0 items-center justify-center rounded-full"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
        <div ref={contentRef}>{children}</div>
      </div>
    </dialog>
  );
}
