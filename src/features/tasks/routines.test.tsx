import { screen, within } from '@testing-library/react';
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

function addRoutine(userId: string, title: string, dueOn: string) {
  fakeTasksBackend.addTaskAs(userId, {
    title,
    type: 'physical',
    points: 1,
    repeatEveryDays: 1,
    dueOn,
    isRoutine: true,
  });
}

const routines = () => screen.getByRole('region', { name: 'Routines' });

describe('routines on the board', () => {
  it('shows routines as chips rather than cards, and marks one done with a tap', async () => {
    const anna = logInAsFamilyMember();
    addRoutine(anna.id, 'Empty the dishwasher', '2026-10-08');
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    const user = userEvent.setup();
    renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(
      screen.queryByRole('listitem', { name: 'Empty the dishwasher' }),
    ).not.toBeInTheDocument();

    await user.click(
      within(routines()).getByRole('button', { name: 'Mark done: Empty the dishwasher' }),
    );

    expect(await within(routines()).findByText('Done by you')).toBeInTheDocument();
    expect(within(routines()).getByText('Empty the dishwasher')).toBeInTheDocument();
    expect(
      within(routines()).queryByRole('button', { name: /^Mark done/ }),
    ).not.toBeInTheDocument();
  });

  it('can still mark an overdue routine done', async () => {
    const anna = logInAsFamilyMember();
    addRoutine(anna.id, 'Water plants', '2026-10-05');
    renderAppAt('/');

    expect(
      await within(await screen.findByRole('region', { name: 'Routines' })).findByRole('button', {
        name: 'Mark done: Water plants',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Overdue' })).not.toBeInTheDocument();
  });

  it('shows routines as cards when searching, so they can be found and edited', async () => {
    const anna = logInAsFamilyMember();
    addRoutine(anna.id, 'Empty the dishwasher', '2026-10-08');
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
    addRoutine(anna.id, 'Empty the dishwasher', '2026-10-08');
    addRoutine(anna.id, 'Feed the cat', '2026-10-07');
    const user = userEvent.setup();
    const { unmount } = renderAppAt('/');
    const toggle = await screen.findByRole('button', { name: /^Routines/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('2');
    expect(
      screen.queryByRole('button', { name: 'Mark done: Feed the cat' }),
    ).not.toBeInTheDocument();
    unmount();

    renderAppAt('/');

    expect(await screen.findByRole('button', { name: /^Routines/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

describe('making a task a routine', () => {
  it('is offered for a repeating task and puts it among the routines', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Empty the dishwasher');
    expect(screen.queryByRole('checkbox', { name: /Quick routine/ })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Repeats'), 'Every day');
    await user.click(screen.getByRole('checkbox', { name: /Quick routine/ }));
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(
      await within(await screen.findByRole('region', { name: 'Routines' })).findByRole('button', {
        name: 'Mark done: Empty the dishwasher',
      }),
    ).toBeInTheDocument();
  });
});
