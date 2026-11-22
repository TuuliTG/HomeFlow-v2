import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ALWAYS_TASK_PAUSE_MS } from '@/features/tasks/task';
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

function addRoutine(userId: string, title: string) {
  fakeTasksBackend.addTaskAs(userId, { title, type: 'physical', points: 1, isRoutine: true });
}

const routines = () => screen.getByRole('region', { name: 'Routines' });
const menu = () => within(screen.getByRole('dialog'));

async function openRoutine(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(
    await within(await screen.findByRole('region', { name: 'Routines' })).findByRole('button', {
      name: new RegExp(`^${title}`),
    }),
  );
  expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
}

describe('routines on the board', () => {
  it('shows routines as chips rather than cards, and marks one done from its menu', async () => {
    const anna = logInAsFamilyMember();
    addRoutine(anna.id, 'Empty the dishwasher');
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    const user = userEvent.setup();
    renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(
      screen.queryByRole('listitem', { name: 'Empty the dishwasher' }),
    ).not.toBeInTheDocument();

    await openRoutine(user, 'Empty the dishwasher');
    await user.click(menu().getByRole('button', { name: 'Mark done' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await within(routines()).findByRole('button', {
      name: /^Empty the dishwasher\s*Done by you$/,
    });
    expect(screen.getByRole('button', { name: /^Routines/ })).toHaveTextContent('0');
    await openRoutine(user, 'Empty the dishwasher');
    expect(menu().queryByRole('button', { name: 'Mark done' })).not.toBeInTheDocument();
  });

  it('opens the routine to edit from its menu', async () => {
    const anna = logInAsFamilyMember();
    addRoutine(anna.id, 'Empty the dishwasher');
    const user = userEvent.setup();
    renderAppAt('/');

    await openRoutine(user, 'Empty the dishwasher');
    await user.click(menu().getByRole('link', { name: 'Edit' }));

    expect(await screen.findByLabelText('Task')).toHaveValue('Empty the dishwasher');
  });

  it('deletes the routine from its menu', async () => {
    const anna = logInAsFamilyMember();
    addRoutine(anna.id, 'Empty the dishwasher');
    addRoutine(anna.id, 'Feed the cat');
    const user = userEvent.setup();
    renderAppAt('/');

    await openRoutine(user, 'Empty the dishwasher');
    await user.click(menu().getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(
        within(routines()).queryByRole('button', { name: /^Empty the dishwasher/ }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^Routines/ })).toHaveFocus();
    expect(fakeTasksBackend.taskCount()).toBe(1);
  });

  it('closes the menu without doing anything', async () => {
    const anna = logInAsFamilyMember();
    addRoutine(anna.id, 'Empty the dishwasher');
    const user = userEvent.setup();
    renderAppAt('/');

    await openRoutine(user, 'Empty the dishwasher');
    await user.click(menu().getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(fakeTasksBackend.taskCount()).toBe(1);
  });

  it('can be done again once its short pause is over', async () => {
    const anna = logInAsFamilyMember();
    const routineId = fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Empty the dishwasher',
      type: 'physical',
      points: 1,
      isRoutine: true,
    });
    fakeTasksBackend.completeTaskAs(anna.id, routineId, '2026-10-08');
    // The clock stands still here, so a moment more than the pause.
    fakeTasksBackend.ageCompletions(ALWAYS_TASK_PAUSE_MS + 1000);
    const user = userEvent.setup();
    renderAppAt('/');

    await openRoutine(user, 'Empty the dishwasher');
    await user.click(menu().getByRole('button', { name: 'Mark done' }));

    await waitFor(() => {
      expect(fakeTasksBackend.taskCount()).toBe(3);
    });
  });

  it('shows routines as cards when searching, so they can be found and edited', async () => {
    const anna = logInAsFamilyMember();
    addRoutine(anna.id, 'Empty the dishwasher');
    const user = userEvent.setup();
    renderAppAt('/');
    await screen.findByRole('region', { name: 'Routines' });

    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'dishwasher');

    expect(screen.getByRole('listitem', { name: 'Empty the dishwasher' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Routines' })).not.toBeInTheDocument();
  });
});

describe('hiding the routines', () => {
  it('folds them away, saying how many are still to do, and remembers it on this device', async () => {
    const anna = logInAsFamilyMember();
    addRoutine(anna.id, 'Empty the dishwasher');
    addRoutine(anna.id, 'Feed the cat');
    const user = userEvent.setup();
    const { unmount } = renderAppAt('/');
    const toggle = await screen.findByRole('button', { name: /^Routines/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('2');
    expect(screen.queryByRole('button', { name: 'Feed the cat' })).not.toBeInTheDocument();
    unmount();

    renderAppAt('/');

    expect(await screen.findByRole('button', { name: /^Routines/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

describe('making a task a routine', () => {
  it('is chosen first, leaves out when the task is due, and puts it among the routines', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    const routine = await screen.findByRole('button', { name: 'Routine' });
    await user.selectOptions(screen.getByLabelText('Repeats'), 'Every day');
    await user.click(routine);
    expect(routine).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Repeats')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Due date')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Already done' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Task'), 'Empty the dishwasher');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(
      await within(await screen.findByRole('region', { name: 'Routines' })).findByRole('button', {
        name: 'Empty the dishwasher',
      }),
    ).toBeInTheDocument();
  });

  it('is not offered for a private task', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('button', { name: 'Private' }));

    expect(screen.queryByRole('button', { name: 'Routine' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Repeats')).toBeInTheDocument();
  });
});
