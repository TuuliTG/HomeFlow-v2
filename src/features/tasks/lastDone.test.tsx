import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

/** Sets the clock to midday on `day` October 2026 where the test runs. */
function setDay(day: number) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, day, 12));
}

afterEach(() => {
  vi.useRealTimers();
});

function addBen() {
  const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  return ben;
}

const vacuum = { title: 'Vacuum', type: 'physical', points: 3, repeatEveryDays: 7 } as const;

describe('who last did a task', () => {
  it('shows who did the previous occurrence of a repeating task, and how long ago', async () => {
    logInAsFamilyMember();
    const ben = addBen();
    setDay(5);
    const taskId = fakeTasksBackend.addTaskAs(ben.id, vacuum);
    fakeTasksBackend.completeTaskAs(ben.id, taskId, '2026-10-05');
    setDay(8);
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(within(task).getByText('Last done by Ben, 3 days ago')).toBeInTheDocument();
  });

  it('says today, or yesterday, for the latest days', async () => {
    const anna = logInAsFamilyMember();
    setDay(7);
    const taskId = fakeTasksBackend.addTaskAs(anna.id, vacuum);
    fakeTasksBackend.completeTaskAs(anna.id, taskId, '2026-10-07');
    setDay(8);
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(within(task).getByText('Last done by you, yesterday')).toBeInTheDocument();
  });

  it('updates the next occurrence when the user marks a task done', async () => {
    setDay(8);
    logInAsFamilyMember();
    const ben = addBen();
    fakeTasksBackend.addTaskAs(ben.id, vacuum);
    const user = userEvent.setup();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(within(task).queryByText(/Last done/)).not.toBeInTheDocument();
    await user.click(within(task).getByRole('button', { name: 'Mark done: Vacuum' }));

    expect(await screen.findByText('Last done by you, today')).toBeInTheDocument();
  });

  it("isn't shown for private tasks", async () => {
    setDay(8);
    const anna = logInAsFamilyMember();
    const taskId = fakeTasksBackend.addTaskAs(anna.id, {
      ...vacuum,
      points: null,
      isPrivate: true,
    });
    fakeTasksBackend.completeTaskAs(anna.id, taskId, '2026-10-08');
    renderAppAt('/me');

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(within(task).getByText('Private')).toBeInTheDocument();
    expect(within(task).queryByText(/Last done/)).not.toBeInTheDocument();
  });
});
