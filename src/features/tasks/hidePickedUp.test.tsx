import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

function addTask(userId: string, title: string) {
  fakeTasksBackend.addTaskAs(userId, { title, type: 'physical', points: 3 });
}

describe('showing only tasks to pick up on the board', () => {
  it('hides tasks someone has picked up, and private tasks', async () => {
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

    await user.click(screen.getByRole('switch', { name: 'Only tasks to pick up' }));

    expect(screen.getByRole('listitem', { name: 'Water plants' })).toBeInTheDocument();
    for (const hidden of ['Vacuum', 'Book dentist', 'Buy a present']) {
      expect(screen.queryByRole('listitem', { name: hidden })).not.toBeInTheDocument();
    }
  });

  it('can be turned off again, and is remembered in the address with "Show completed"', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum');
    fakeTasksBackend.pickUpTaskAs(anna.id, 'task:0');
    const user = userEvent.setup();
    renderAppAt('/?unpicked=1&completed=1');

    const toggle = await screen.findByRole('switch', { name: 'Only tasks to pick up' });
    expect(toggle).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show completed' })).toBeChecked();
    expect(await screen.findByText('Every task has been picked up.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Vacuum' })).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(screen.getByRole('listitem', { name: 'Vacuum' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Show completed' })).toBeChecked();
  });
});
