import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { SwipeToDelete } from '@/components/ui/SwipeToDelete';

function renderCard() {
  const onDelete = vi.fn(() => Promise.resolve());
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

/** A list of two cards, Dust first and then Vacuum, deleting Dust taking it off the list. */
function DeletableList() {
  const [titles, setTitles] = useState(['Dust', 'Vacuum']);
  return (
    <ul>
      {titles.map((title) => (
        <li key={title}>
          <SwipeToDelete
            label={`Delete: ${title}`}
            onDelete={() => {
              setTitles((current) => current.filter((other) => other !== title));
              return Promise.resolve();
            }}
            disabled={false}
            className="rounded-2xl"
            contentClassName="bg-surface"
          >
            <button type="button">{title}</button>
          </SwipeToDelete>
        </li>
      ))}
    </ul>
  );
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

  it('moves focus to the next card after deleting with the keyboard', async () => {
    render(<DeletableList />);
    const user = userEvent.setup();

    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('button', { name: 'Vacuum' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Dust' })).not.toBeInTheDocument();
  });

  it('follows only the finger that started the swipe', () => {
    const { content } = renderCard();

    fireEvent.pointerDown(content, { pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(content, { pointerId: 2, clientX: 100, clientY: 100 });

    expect(content).toHaveStyle({ transform: 'translateX(0px)' });
  });

  it('goes back to where it was when the swipe is cancelled', () => {
    const { content } = renderCard();

    fireEvent.pointerDown(content, { pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(content, { pointerId: 1, clientX: 150, clientY: 100 });
    fireEvent.pointerCancel(content, { pointerId: 1, clientX: 0, clientY: 100 });

    expect(content).toHaveStyle({ transform: 'translateX(0px)' });
  });
});
