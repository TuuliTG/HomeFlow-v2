import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

function addBen() {
  const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  return ben;
}

describe('private tasks', () => {
  it('can be added with a check mark and are marked private on the board', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    const privateBox = await screen.findByRole('checkbox', { name: 'Keep it private' });
    expect(privateBox).not.toBeChecked();
    await user.type(screen.getByLabelText('Task'), 'Buy a birthday present');
    await user.click(privateBox);
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Buy a birthday present' });
    expect(within(task).getByText('Private')).toBeInTheDocument();
  });

  it('have no points', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Buy a birthday present');
    expect(screen.getByLabelText('Points')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Keep it private' }));
    expect(screen.queryByLabelText('Points')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Buy a birthday present' });
    expect(within(task).queryByText(/points/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Edit: Buy a birthday present' }));
    expect(await screen.findByLabelText('Task')).toHaveValue('Buy a birthday present');
    expect(screen.queryByLabelText('Points')).not.toBeInTheDocument();
  });

  it("don't add to the points of whoever does them", async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Buy a present',
      type: 'meta',
      points: null,
      isPrivate: true,
    });
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-09');
    fakeTasksBackend.completeTaskAs(anna.id, 'task:1', '2026-10-09');
    renderAppAt('/me');

    const total = await screen.findByRole('region', { name: 'Points earned' });
    expect(await within(total).findByText('3')).toBeInTheDocument();
    const done = (await screen.findByText('Buy a present')).closest('li');
    expect(done).not.toBeNull();
    expect(done).not.toHaveTextContent(/points/);
  });

  it('are shared with the family unless checked', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Vacuum');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(within(task).queryByText('Private')).not.toBeInTheDocument();
  });

  it("don't show up for other members, not even live", async () => {
    logInAsFamilyMember();
    const ben = addBen();
    fakeTasksBackend.addTaskAs(ben.id, { title: 'Vacuum', type: 'physical', points: 3 });
    renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Vacuum' });

    act(() => {
      fakeTasksBackend.addTaskAs(ben.id, {
        title: 'Plan a surprise party',
        type: 'meta',
        points: null,
        isPrivate: true,
      });
    });

    await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(screen.queryByText('Plan a surprise party')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ben added/)).not.toBeInTheDocument();
  });

  it('keep the next occurrence of a repeating task private', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Water my plants',
      type: 'physical',
      points: null,
      repeatEveryDays: 7,
      isPrivate: true,
    });
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(await screen.findByRole('button', { name: 'Mark done: Water my plants' }));

    const next = await screen.findByRole('listitem', { name: 'Water my plants' });
    expect(within(next).getByText('Private')).toBeInTheDocument();
  });
});
