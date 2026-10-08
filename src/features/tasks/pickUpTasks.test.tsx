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

  it("shows who has picked up a task, which others can't take but can still mark done", async () => {
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
