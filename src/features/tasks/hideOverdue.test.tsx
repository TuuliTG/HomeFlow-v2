import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

/** Wednesday 8 October 2026, midday where the test runs. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

function addTask(userId: string, title: string, dueOn: string) {
  fakeTasksBackend.addTaskAs(userId, { title, type: 'physical', points: 1, dueOn });
}

const overdueToggle = () => screen.getByRole('button', { name: /^Overdue/ });

describe('hiding overdue tasks', () => {
  it('folds the overdue tasks away, saying how many there are, and shows them again', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum', '2026-10-06');
    addTask(anna.id, 'Mop', '2026-10-07');
    addTask(anna.id, 'Cook', '2026-10-08');
    const user = userEvent.setup();
    renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(overdueToggle()).toHaveAttribute('aria-expanded', 'true');

    await user.click(overdueToggle());

    expect(overdueToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(overdueToggle()).toHaveTextContent('2');
    expect(screen.queryByRole('listitem', { name: 'Vacuum' })).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Mop' })).not.toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Cook' })).toBeInTheDocument();

    await user.click(overdueToggle());

    expect(screen.getByRole('listitem', { name: 'Vacuum' })).toBeInTheDocument();
  });

  it('remembers on this device that they are hidden', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum', '2026-10-06');
    const user = userEvent.setup();
    const { unmount } = renderAppAt('/');
    await user.click(await screen.findByRole('button', { name: /^Overdue/ }));
    unmount();

    renderAppAt('/');

    expect(await screen.findByRole('button', { name: /^Overdue/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('listitem', { name: 'Vacuum' })).not.toBeInTheDocument();
  });
});
