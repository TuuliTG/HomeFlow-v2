import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

function addTask(userId: string, title: string, points = 3) {
  fakeTasksBackend.addTaskAs(userId, { title, type: 'physical', points });
}

describe('showing completed tasks on the board', () => {
  it("lists the household's done tasks, newest first, with who did them", async () => {
    const anna = logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    addTask(anna.id, 'Vacuum');
    addTask(anna.id, 'Book dentist', 5);
    addTask(anna.id, 'Water plants');
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-08');
    fakeTasksBackend.completeTaskAs(ben.id, 'task:1', '2026-10-08');
    const user = userEvent.setup();
    renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Water plants' });
    expect(screen.queryByRole('region', { name: 'Completed' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Show completed' }));

    const completed = await screen.findByRole('region', { name: 'Completed' });
    const items = await within(completed).findAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^Book dentistDone by Ben · .* · 5 pointsAdd again$/),
      expect.stringMatching(/^VacuumDone by you · .* · 3 pointsAdd again$/),
    ]);
    expect(screen.getByRole('listitem', { name: 'Water plants' })).toBeInTheDocument();
  });

  it('can be hidden again, and is remembered in the address', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum');
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-08');
    const user = userEvent.setup();
    renderAppAt('/?completed=1');

    const toggle = await screen.findByRole('switch', { name: 'Show completed' });
    expect(toggle).toBeChecked();
    expect(await screen.findByRole('region', { name: 'Completed' })).toHaveTextContent('Vacuum');

    await user.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(screen.queryByRole('region', { name: 'Completed' })).not.toBeInTheDocument();
  });

  it('says when nothing has been done yet', async () => {
    logInAsFamilyMember();
    renderAppAt('/?completed=1');

    const completed = await screen.findByRole('region', { name: 'Completed' });
    expect(await within(completed).findByText('Nothing done yet.')).toBeInTheDocument();
  });

  it('explains when completed tasks cannot be loaded', async () => {
    logInAsFamilyMember();
    fakeTasksBackend.failRequests();
    renderAppAt('/?completed=1');

    const completed = await screen.findByRole('region', { name: 'Completed' });
    expect(await within(completed).findByRole('alert')).toHaveTextContent(
      "We couldn't load the completed tasks.",
    );
  });
});
