import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { SwipeToDelete } from '@/components/ui/SwipeToDelete';

function renderCard() {
  const onDelete = vi.fn();
  const onOpen = vi.fn();
  render(
    <SwipeToDelete
      label="Delete: Dust"
      onDelete={onDelete}
      disabled={false}
      className="rounded-2xl"
      contentClassName="bg-surface"
    >
      <button type="button" onClick={onOpen}>
        Dust
      </button>
    </SwipeToDelete>,
  );
  const content = screen.getByRole('button', { name: 'Dust' }).parentElement;
  if (!content) throw new Error('The content is missing.');
  return { content, onDelete, onOpen };
}

/** A finger moving across the content from x 200, y 100 by `dx` and `dy`, then lifted. */
function swipe(content: HTMLElement, dx: number, dy = 0) {
  fireEvent.pointerDown(content, { pointerId: 1, clientX: 200, clientY: 100 });
  fireEvent.pointerMove(content, { pointerId: 1, clientX: 200 + dx / 2, clientY: 100 + dy / 2 });
  fireEvent.pointerMove(content, { pointerId: 1, clientX: 200 + dx, clientY: 100 + dy });
  fireEvent.pointerUp(content, { pointerId: 1, clientX: 200 + dx, clientY: 100 + dy });
}

beforeAll(() => {
  // jsdom has no pointer capture.
  HTMLElement.prototype.setPointerCapture = vi.fn();
});

describe('SwipeToDelete', () => {
  it('slides open when swiped left past half the button, showing it', () => {
    const { content } = renderCard();

    swipe(content, -60);

    expect(content).toHaveStyle({ transform: 'translateX(-80px)' });
  });

  it('slides back after a short swipe, or one up or down', () => {
    const { content } = renderCard();

    swipe(content, -30);
    expect(content).toHaveStyle({ transform: 'translateX(0px)' });
    swipe(content, -20, 80);
    expect(content).toHaveStyle({ transform: 'translateX(0px)' });
  });

  it("doesn't tap the content when a swipe ends, and closes instead of tapping it while open", async () => {
    const { content, onOpen } = renderCard();
    swipe(content, -100);
    // A mouse drag ends with a click.
    fireEvent.click(screen.getByRole('button', { name: 'Dust' }));
    expect(content).toHaveStyle({ transform: 'translateX(-80px)' });

    await userEvent.click(screen.getByRole('button', { name: 'Dust' }));

    expect(content).toHaveStyle({ transform: 'translateX(0px)' });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('closes on a tap elsewhere', () => {
    const { content } = renderCard();
    swipe(content, -100);

    fireEvent.pointerDown(document.body);

    expect(content).toHaveStyle({ transform: 'translateX(0px)' });
  });

  it('opens when the delete button gets focus, and deletes when it is pressed', async () => {
    const { content, onDelete } = renderCard();
    const user = userEvent.setup();

    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Delete: Dust' })).toHaveFocus();
    expect(content).toHaveStyle({ transform: 'translateX(-80px)' });
    await user.keyboard('{Enter}');

    expect(onDelete).toHaveBeenCalledOnce();
  });
});
