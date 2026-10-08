import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksApi';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

function addBen() {
  const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  return ben;
}

function addTask(userId: string, title: string) {
  fakeTasksBackend.addTaskAs(userId, { title, type: 'physical', points: 3 });
}

describe('picking up tasks', () => {
  it('shows a picked-up task as yours on the board and on the Me screen', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum');
    const user = userEvent.setup();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    await user.click(within(task).getByRole('button', { name: 'Pick up: Vacuum' }));

    expect(await within(task).findByText('Picked up by you')).toBeInTheDocument();
    expect(within(task).queryByRole('button', { name: /^Pick up/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Me' }));
    const toDo = screen.getByRole('region', { name: 'To do' });
    expect(await within(toDo).findByRole('listitem', { name: 'Vacuum' })).toBeInTheDocument();
  });

  it('can be put back, so anyone can pick the task up again', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum');
    fakeTasksBackend.pickUpTaskAs(anna.id, 'task:0');
    const user = userEvent.setup();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    await user.click(within(task).getByRole('button', { name: 'Put back: Vacuum' }));

    expect(
      await within(task).findByRole('button', { name: 'Pick up: Vacuum' }),
    ).toBeInTheDocument();
    expect(within(task).queryByText(/^Picked up by/)).not.toBeInTheDocument();
  });

  it('shows who has picked up a task, and asks before you mark it done for them', async () => {
    logInAsFamilyMember();
    const ben = addBen();
    addTask(ben.id, 'Book dentist');
    fakeTasksBackend.pickUpTaskAs(ben.id, 'task:0');
    const user = userEvent.setup();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Book dentist' });
    expect(within(task).getByText('Picked up by Ben')).toBeInTheDocument();
    expect(within(task).queryByRole('button', { name: /^(Pick up|Put back)/ })).toBeNull();

    await user.click(within(task).getByRole('button', { name: 'Mark done: Book dentist' }));
    const confirm = within(task).getByRole('group', { name: 'Mark done for Ben?' });
    expect(confirm).toHaveTextContent('Ben has picked this up. Mark it done anyway?');
    await user.click(within(confirm).getByRole('button', { name: 'Yes, I did it' }));

    expect(await screen.findByText('No tasks yet. Create the first one!')).toBeInTheDocument();
  });

  it("can be called off, leaving the other member's task as it was", async () => {
    logInAsFamilyMember();
    const ben = addBen();
    addTask(ben.id, 'Book dentist');
    fakeTasksBackend.pickUpTaskAs(ben.id, 'task:0');
    const user = userEvent.setup();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Book dentist' });
    await user.click(within(task).getByRole('button', { name: 'Mark done: Book dentist' }));
    await user.click(within(task).getByRole('button', { name: 'Cancel' }));

    expect(within(task).queryByRole('group')).not.toBeInTheDocument();
    expect(within(task).getByText('Picked up by Ben')).toBeInTheDocument();
  });

  it("doesn't ask before marking done your own or a free task", async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum');
    addTask(anna.id, 'Dust');
    fakeTasksBackend.pickUpTaskAs(anna.id, 'task:0');
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(await screen.findByRole('button', { name: 'Mark done: Vacuum' }));
    await user.click(screen.getByRole('button', { name: 'Mark done: Dust' }));

    expect(await screen.findByText('No tasks yet. Create the first one!')).toBeInTheDocument();
  });

  it('shows a task another member picks up while the board is open', async () => {
    logInAsFamilyMember();
    const ben = addBen();
    addTask(ben.id, 'Dust');
    renderAppAt('/');
    const task = await screen.findByRole('listitem', { name: 'Dust' });

    act(() => {
      fakeTasksBackend.pickUpTaskAs(ben.id, 'task:0');
    });

    expect(await within(task).findByText('Picked up by Ben')).toBeInTheDocument();
  });

  it('explains when a task cannot be picked up, and keeps the board', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Dust');
    const user = userEvent.setup();
    renderAppAt('/');
    const task = await screen.findByRole('listitem', { name: 'Dust' });
    fakeTasksBackend.failRequests();

    await user.click(within(task).getByRole('button', { name: 'Pick up: Dust' }));

    expect(await within(task).findByRole('alert')).toHaveTextContent(
      "We couldn't pick up the task. Someone may have taken it first.",
    );
    expect(screen.getByRole('listitem', { name: 'Dust' })).toBeInTheDocument();
  });

  it('explains when a task cannot be put back', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum');
    fakeTasksBackend.pickUpTaskAs(anna.id, 'task:0');
    const user = userEvent.setup();
    renderAppAt('/');
    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    fakeTasksBackend.failRequests();

    await user.click(within(task).getByRole('button', { name: 'Put back: Vacuum' }));

    expect(await within(task).findByRole('alert')).toHaveTextContent(
      "We couldn't put the task back.",
    );
  });
});

describe('Me screen', () => {
  it("shows the total points you've earned from all the tasks you've done", async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    for (const [title, points] of [
      ['Vacuum', 3],
      ['Dust', 2],
      ['Book dentist', 5],
    ] as const) {
      fakeTasksBackend.addTaskAs(anna.id, { title, type: 'physical', points });
    }
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-08');
    fakeTasksBackend.completeTaskAs(anna.id, 'task:1', '2026-10-08');
    fakeTasksBackend.completeTaskAs(ben.id, 'task:2', '2026-10-08');
    renderAppAt('/me');

    const total = await screen.findByRole('region', { name: 'Points earned' });
    expect(await within(total).findByText('5')).toBeInTheDocument();
  });

  it('counts a task as soon as you mark it done, and stops counting it if you undo', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    fakeTasksBackend.pickUpTaskAs(anna.id, 'task:0');
    const user = userEvent.setup();
    renderAppAt('/me');
    const total = await screen.findByRole('region', { name: 'Points earned' });
    expect(await within(total).findByText('0')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Mark done: Vacuum' }));
    expect(await within(total).findByText('3')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Undo: Vacuum' }));
    expect(await within(total).findByText('0')).toBeInTheDocument();
  });

  it('explains when the points cannot be loaded', async () => {
    logInAsFamilyMember();
    fakeTasksBackend.failRequests();
    renderAppAt('/me');

    const total = await screen.findByRole('region', { name: 'Points earned' });
    expect(await within(total).findByRole('alert')).toHaveTextContent(
      "We couldn't load your points.",
    );
  });

  it("lists only the tasks you've picked up under To do", async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    addTask(anna.id, 'Vacuum');
    addTask(anna.id, 'Dust');
    addTask(anna.id, 'Water plants');
    fakeTasksBackend.pickUpTaskAs(anna.id, 'task:0');
    fakeTasksBackend.pickUpTaskAs(ben.id, 'task:1');
    renderAppAt('/me');

    const toDo = await screen.findByRole('region', { name: 'To do' });
    await within(toDo).findByRole('listitem', { name: 'Vacuum' });
    expect(within(toDo).getAllByRole('listitem')).toHaveLength(1);
  });

  it('lists the tasks you marked done, newest first', async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    addTask(anna.id, 'Vacuum');
    addTask(anna.id, 'Dust');
    addTask(anna.id, 'Water plants');
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-08');
    fakeTasksBackend.completeTaskAs(ben.id, 'task:1', '2026-10-08');
    fakeTasksBackend.completeTaskAs(anna.id, 'task:2', '2026-10-08');
    renderAppAt('/me');

    const completed = await screen.findByRole('list', { name: 'Completed tasks' });
    expect(
      within(completed)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringMatching(/^Water plantsDone .* · 3 pointsUndo$/),
      expect.stringMatching(/^VacuumDone /),
    ]);
  });

  it('says when there is nothing to show yet', async () => {
    logInAsFamilyMember();
    renderAppAt('/me');

    expect(
      await screen.findByText('Nothing picked up yet. Pick a task on the board.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Tasks you mark done will show up here.')).toBeInTheDocument();
  });

  it('moves a task from To do to Completed when you mark it done', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum');
    fakeTasksBackend.pickUpTaskAs(anna.id, 'task:0');
    const user = userEvent.setup();
    renderAppAt('/me');

    const toDo = await screen.findByRole('region', { name: 'To do' });
    await user.click(await within(toDo).findByRole('button', { name: 'Mark done: Vacuum' }));

    expect(await within(toDo).findByText(/^Nothing picked up yet/)).toBeInTheDocument();
    const completed = await screen.findByRole('list', { name: 'Completed tasks' });
    expect(within(completed).getByText('Vacuum')).toBeInTheDocument();
  });

  it('explains when the tasks cannot be loaded', async () => {
    logInAsFamilyMember();
    fakeTasksBackend.failRequests();
    renderAppAt('/me');

    expect(await screen.findByText(/^We couldn't load your tasks\./)).toBeInTheDocument();
    expect(await screen.findByText(/^We couldn't load your completed tasks\./)).toBeInTheDocument();
  });
});
