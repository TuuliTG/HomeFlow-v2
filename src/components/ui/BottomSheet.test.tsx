import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { BottomSheet } from '@/components/ui/BottomSheet';

function Opener() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
        }}
      >
        Open
      </button>
      {isOpen && (
        <BottomSheet
          title="Feed the cat"
          onClose={() => {
            setIsOpen(false);
          }}
        >
          <button type="button">Mark done</button>
        </BottomSheet>
      )}
    </>
  );
}

describe('BottomSheet', () => {
  it('focuses its first control and gives the focus back when closed', async () => {
    const user = userEvent.setup();
    render(<Opener />);

    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('dialog', { name: 'Feed the cat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark done' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  it('closes on a tap outside it, but not inside it', async () => {
    const user = userEvent.setup();
    render(<Opener />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog');

    await user.click(screen.getByRole('heading', { name: 'Feed the cat' }));
    expect(dialog).toBeInTheDocument();

    // A tap on the backdrop lands on the dialog element itself.
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
