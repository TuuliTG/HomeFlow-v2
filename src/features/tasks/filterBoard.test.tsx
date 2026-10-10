import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

function addTask(userId: string, title: string, dueOn: string | null = null) {
  fakeTasksBackend.addTaskAs(userId, { title, type: 'physical', points: 3, dueOn });
}

function expectShown(shown: string[], hidden: string[]) {
  for (const title of shown) {
    expect(screen.getByRole('listitem', { name: title })).toBeInTheDocument();
  }
  for (const title of hidden) {
    expect(screen.queryByRole('listitem', { name: title })).not.toBeInTheDocument();
  }
}

/** Wednesday 8 October 2026, midday where the test runs. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('filtering the board', () => {
  it('shows all tasks until a filter is chosen', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum', '2026-10-08');
    addTask(anna.id, 'Dust');
    renderAppAt('/');

    await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    expectShown(['Vacuum', 'Dust'], []);
  });

  it("shows today's tasks, this week's or those without a due date", async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum', '2026-10-06');
    addTask(anna.id, 'Cook', '2026-10-08');
    addTask(anna.id, 'Mop', '2026-10-14');
    addTask(anna.id, 'Change bed linen', '2026-10-22');
    addTask(anna.id, 'Dust');
    const user = userEvent.setup();
    renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Vacuum' });

    await user.click(screen.getByRole('radio', { name: 'Today' }));
    expectShown(['Vacuum', 'Cook'], ['Mop', 'Change bed linen', 'Dust']);

    await user.click(screen.getByRole('radio', { name: 'This week' }));
    expectShown(['Vacuum', 'Cook', 'Mop'], ['Change bed linen', 'Dust']);

    await user.click(screen.getByRole('radio', { name: 'No due date' }));
    expectShown(['Dust'], ['Vacuum', 'Cook', 'Mop', 'Change bed linen']);

    await user.click(screen.getByRole('radio', { name: 'All' }));
    expectShown(['Vacuum', 'Cook', 'Mop', 'Change bed linen', 'Dust'], []);
  });

  it('shows the tasks available to pick up, without private tasks', async () => {
    const anna = logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    addTask(anna.id, 'Vacuum');
    addTask(anna.id, 'Book dentist');
    addTask(anna.id, 'Water plants');
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Buy a present',
      type: 'meta',
      points: null,
      isPrivate: true,
    });
    fakeTasksBackend.pickUpTaskAs(anna.id, 'task:0');
    fakeTasksBackend.pickUpTaskAs(ben.id, 'task:1');
    const user = userEvent.setup();
    renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Vacuum' });

    await user.click(screen.getByRole('radio', { name: 'Available' }));

    expectShown(['Water plants'], ['Vacuum', 'Book dentist', 'Buy a present']);
  });

  it('keeps the choice in the address, and goes back to all from the nav', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Dust');
    const user = userEvent.setup();
    const { router } = renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Dust' });

    await user.click(screen.getByRole('radio', { name: 'This week' }));
    expect(router.state.location.search).toBe('?show=week');

    await user.click(screen.getByRole('link', { name: 'Shared tasks' }));
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    expectShown(['Dust'], []);
  });

  it('says when nothing matches, and is read from the address with "Show completed"', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Dust');
    renderAppAt('/?show=today&completed=1');

    expect(await screen.findByText('Nothing is due today.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Today' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show completed' })).toBeChecked();
    expectShown([], ['Dust']);
  });
});
