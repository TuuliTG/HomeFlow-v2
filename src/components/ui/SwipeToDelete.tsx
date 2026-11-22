import {
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import { TrashIcon } from '@/components/ui/icons';

/** How far the content slides to show the delete button, in pixels: the button's width. */
const OPEN_OFFSET = 80;
/** How far a finger moves before it counts as a swipe or a scroll, in pixels. */
const SLOP = 8;

/** What the content's first control after a delete is found by. */
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea';

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  /** Where the content was when the drag started. */
  from: number;
  /** Whether the drag is sideways (a swipe), up or down (a scroll), or not yet known. */
  direction: 'sideways' | 'other' | null;
}

interface SwipeToDeleteProps {
  /** The delete button's accessible name, e.g. "Delete: Make the bed". */
  label: string;
  /** Deletes; resolves once the content is gone, rejects when deleting fails. */
  onDelete: () => Promise<void>;
  disabled: boolean;
  /** The frame's shape and shadow, e.g. `rounded-2xl shadow-card`; it clips the content to it. */
  className: string;
  /** The sliding content's own classes: its background, padding and layout. */
  contentClassName: string;
  children: ReactNode;
}

/**
 * Content that slides left when swiped to show a delete button behind it. Tapping the content or anywhere else
 * slides it back. The button is in the tab order, and focusing it slides the content open, so it can be reached
 * without swiping; deleting with the keyboard moves focus to the next item of the list it is in (or the one before).
 */
export function SwipeToDelete({
  label,
  onDelete,
  disabled,
  className,
  contentClassName,
  children,
}: SwipeToDeleteProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<Drag | null>(null);
  // A click right after a swipe ends it, rather than opening a link in the content.
  const justSwiped = useRef(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const isOpen = offset !== 0;
  useCloseOnOutsidePointer(frameRef, isOpen, setOffset);
  useNoDragAndDrop(frameRef);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    justSwiped.current = false;
    if (drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    // Dragging in a field selects its text, not the content.
    if (event.target instanceof Element && event.target.closest('input, textarea, select')) return;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      from: offset,
      direction: null,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (current.direction === null) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP) return;
      current.direction = Math.abs(dx) > Math.abs(dy) ? 'sideways' : 'other';
      if (current.direction === 'sideways') {
        event.currentTarget.setPointerCapture(event.pointerId);
        // A mouse drag would otherwise select the text it starts on.
        window.getSelection()?.removeAllRanges();
        setIsDragging(true);
      }
    }
    if (current.direction === 'sideways') setOffset(slid(current.from + dx));
  }

  /** Ends the drag by `event`'s pointer, if it is the one dragging; returns it if it was a swipe. */
  function endDrag(event: PointerEvent<HTMLDivElement>): Drag | null {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return null;
    drag.current = null;
    if (current.direction !== 'sideways') return null;
    setIsDragging(false);
    return current;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const swipe = endDrag(event);
    if (!swipe) return;
    // A touch swipe usually ends without a click, so the next click isn't the one ending it.
    justSwiped.current = true;
    setTimeout(() => {
      justSwiped.current = false;
    });
    const at = slid(swipe.from + event.clientX - swipe.startX);
    setOffset(at < -OPEN_OFFSET / 2 ? -OPEN_OFFSET : 0);
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    // A cancelled pointer has no reliable position: back to where the swipe started.
    const swipe = endDrag(event);
    if (swipe) setOffset(swipe.from);
  }

  function handleDelete(event: MouseEvent<HTMLButtonElement>) {
    const byKeyboard = event.detail === 0;
    const item = frameRef.current?.closest('li');
    const next = item?.nextElementSibling ?? item?.previousElementSibling;
    onDelete().then(
      () => {
        if (byKeyboard) next?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      },
      () => undefined,
    );
  }

  return (
    <div ref={frameRef} className={`relative overflow-hidden ${className}`}>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={(event) => {
          // The click ending a swipe, or a tap while open, which closes it, doesn't reach the content.
          if (!justSwiped.current && !isOpen) return;
          event.preventDefault();
          event.stopPropagation();
          if (!justSwiped.current) setOffset(0);
          justSwiped.current = false;
        }}
        style={{ transform: `translateX(${String(offset)}px)` }}
        className={`relative z-10 touch-pan-y ${isDragging ? 'select-none' : 'motion-safe:transition-transform'} ${contentClassName}`}
      >
        {children}
      </div>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={handleDelete}
        onFocus={() => {
          setOffset(-OPEN_OFFSET);
        }}
        onBlur={() => {
          setOffset(0);
        }}
        style={{ width: OPEN_OFFSET }}
        // Hidden while closed, so it doesn't show at the content's rounded corners; still focusable, which opens it.
        className={`bg-danger-700 focus-visible:outline-surface absolute inset-y-0 right-0 flex items-center justify-center text-white focus-visible:outline-2 focus-visible:-outline-offset-4 disabled:opacity-60 ${isOpen ? '' : 'opacity-0'}`}
      >
        <TrashIcon className="size-6" />
      </button>
    </div>
  );
}

/** Where the content can slide to: from closed to open. */
function slid(offset: number): number {
  return Math.min(0, Math.max(-OPEN_OFFSET, offset));
}

/** Closes the content (sets its offset to 0) when a pointer goes down outside `ref` while it is open. */
function useCloseOnOutsidePointer(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  setOffset: (offset: number) => void,
) {
  useEffect(() => {
    if (!isOpen) return;
    function handle(event: globalThis.PointerEvent) {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) setOffset(0);
    }
    document.addEventListener('pointerdown', handle);
    return () => {
      document.removeEventListener('pointerdown', handle);
    };
  }, [ref, isOpen, setOffset]);
}

/** Stops a link or picture in `ref` from starting the browser's own drag and drop, which would end a swipe. */
function useNoDragAndDrop(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    function prevent(event: DragEvent) {
      event.preventDefault();
    }
    element?.addEventListener('dragstart', prevent);
    return () => {
      element?.removeEventListener('dragstart', prevent);
    };
  }, [ref]);
}
