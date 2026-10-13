import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CELEBRATION_DURATION_MS } from '@/features/tasks/TaskCelebration';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

async function markDone(title: string) {
  const user = userEvent.setup();
  renderAppAt('/');
  await user.click(await screen.findByRole('button', { name: `Mark done: ${title}` }));
  return user;
}

describe('celebrating a done task', () => {
  it('shows the points earned and says the task is done', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });

    await markDone('Vacuum');

    expect(await screen.findByText('+3 points')).toBeInTheDocument();
    expect(screen.getByText('Vacuum done!')).toBeInTheDocument();
    // The stars and points are decorative; screen readers hear the text instead.
    expect(screen.getByText('+3 points').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('celebrates a task without points too, without a points badge', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Water plants', type: 'physical', points: null });

    await markDone('Water plants');

    expect(await screen.findByText('Water plants done!')).toBeInTheDocument();
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it('goes away by itself, and comes back for the next task', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Dishes', type: 'physical', points: 2 });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = await markDone('Vacuum');
      await screen.findByText('+3 points');
      act(() => {
        vi.advanceTimersByTime(CELEBRATION_DURATION_MS);
      });
      expect(screen.queryByText('+3 points')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Mark done: Dishes' }));
      expect(await screen.findByText('+2 points')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not celebrate a task that could not be saved', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    const user = userEvent.setup();
    renderAppAt('/');
    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    fakeTasksBackend.failRequests();

    await user.click(within(task).getByRole('button', { name: 'Mark done: Vacuum' }));

    await within(task).findByRole('alert');
    expect(screen.queryByText('+3 points')).not.toBeInTheDocument();
    expect(screen.queryByText('Vacuum done!')).not.toBeInTheDocument();
  });

  it('leaves saying it is done to the who-helped prompt when that asks', async () => {
    const anna = logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });

    await markDone('Vacuum');

    expect(await screen.findByText('Vacuum done! Did someone help?')).toBeInTheDocument();
    expect(screen.getByText('+3 points')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Vacuum done!')).not.toBeInTheDocument();
    });
  });
});
