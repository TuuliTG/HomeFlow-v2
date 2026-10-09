import { screen, within } from '@testing-library/react';
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

describe('editing a task', () => {
  it("lets any member fix a task's details from the board", async () => {
    logInAsFamilyMember();
    const ben = addBen();
    fakeTasksBackend.addTaskAs(ben.id, { title: 'Vacum', type: 'physical', points: 3 });
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(await screen.findByRole('link', { name: 'Edit: Vacum' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Edit task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Task')).toHaveValue('Vacum');
    expect(screen.getByLabelText('Points')).toHaveValue(3);

    await user.clear(screen.getByLabelText('Task'));
    await user.type(screen.getByLabelText('Task'), 'Vacuum');
    await user.selectOptions(screen.getByLabelText('Repeats'), 'Every week');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(within(task).getByText('Every week')).toBeInTheDocument();
    expect(within(task).getByText('Added by Ben')).toBeInTheDocument();
  });

  it('shows the current repeat and due date, and can remove them', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Change bed linen',
      type: 'physical',
      points: 4,
      repeatEveryDays: 14,
      dueOn: '2030-01-04',
    });
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/edit');

    expect(await screen.findByLabelText('Repeats')).toHaveDisplayValue('Every 2 weeks');
    expect(screen.getByLabelText('Due date')).toHaveValue('2030-01-04');

    await user.selectOptions(screen.getByLabelText('Repeats'), "Doesn't repeat");
    await user.clear(screen.getByLabelText('Due date'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const task = await screen.findByRole('listitem', { name: 'Change bed linen' });
    expect(within(task).queryByText(/^Every/)).not.toBeInTheDocument();
    expect(within(task).queryByText(/due/i)).not.toBeInTheDocument();
  });

  it('keeps the form and explains when the changes cannot be saved', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Dust', type: 'physical', points: 2 });
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/edit');
    await screen.findByLabelText('Task');
    fakeTasksBackend.failRequests();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save the task.");
    expect(screen.getByRole('heading', { level: 1, name: 'Edit task' })).toBeInTheDocument();
  });

  it("says when the task isn't on the board any more", async () => {
    logInAsFamilyMember();
    renderAppAt('/tasks/missing/edit');

    expect(await screen.findByText(/isn't on the board any more/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the tasks' })).toBeInTheDocument();
  });

  it('can add, change and remove the description', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Dust',
      type: 'physical',
      points: 2,
      description: 'Shelves only',
    });
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/edit');

    const description = await screen.findByLabelText('Description (optional)');
    expect(description).toHaveValue('Shelves only');
    await user.clear(description);
    await user.type(description, 'Shelves and lamps');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const task = await screen.findByRole('listitem', { name: 'Dust' });
    expect(within(task).getByText('Shelves and lamps')).toBeInTheDocument();

    await user.click(within(task).getByRole('link', { name: 'Edit: Dust' }));
    await user.clear(await screen.findByLabelText('Description (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('listitem', { name: 'Dust' })).not.toHaveTextContent('Shelves');
  });
});

describe('deleting a task', () => {
  it('asks first, then removes the task for everyone', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Dust', type: 'physical', points: 2 });
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/edit');

    await user.click(await screen.findByRole('button', { name: 'Delete task' }));
    const confirm = screen.getByRole('region', { name: 'Delete task' });
    expect(confirm).toHaveTextContent('Delete “Dust” for everyone in the household?');
    await user.click(within(confirm).getByRole('button', { name: 'Yes, delete' }));

    expect(await screen.findByText('No tasks yet. Create the first one!')).toBeInTheDocument();
  });

  it('can be called off', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Dust', type: 'physical', points: 2 });
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/edit');

    await user.click(await screen.findByRole('button', { name: 'Delete task' }));
    await user.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(screen.queryByRole('region', { name: 'Delete task' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(await screen.findByRole('listitem', { name: 'Dust' })).toBeInTheDocument();
  });

  it('explains when the task cannot be deleted', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Dust', type: 'physical', points: 2 });
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/edit');
    await user.click(await screen.findByRole('button', { name: 'Delete task' }));
    fakeTasksBackend.failRequests();

    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't delete the task.");
  });
});

describe('undoing "Mark done"', () => {
  it('puts a task you just marked done back on the board, without its next occurrence', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Water plants',
      type: 'physical',
      points: 1,
      repeatEveryDays: 3,
    });
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2030-01-01');
    const user = userEvent.setup();
    renderAppAt('/me');

    const completed = await screen.findByRole('list', { name: 'Completed tasks' });
    await user.click(within(completed).getByRole('button', { name: 'Undo: Water plants' }));

    expect(await screen.findByText('Tasks you mark done will show up here.')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Tasks' }));
    expect(await screen.findAllByRole('listitem', { name: 'Water plants' })).toHaveLength(1);
    expect(screen.queryByText('Due Fri 4 Jan')).not.toBeInTheDocument();
  });

  it("isn't offered for tasks done more than an hour ago", async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Dust', type: 'physical', points: 2 });
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-08');
    fakeTasksBackend.ageCompletions(2 * 60 * 60 * 1000);
    renderAppAt('/me');

    const completed = await screen.findByRole('list', { name: 'Completed tasks' });
    expect(within(completed).getByText('Dust')).toBeInTheDocument();
    expect(within(completed).queryByRole('button', { name: /^Undo/ })).not.toBeInTheDocument();
  });

  it('explains when it cannot be undone', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Dust', type: 'physical', points: 2 });
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-08');
    const user = userEvent.setup();
    renderAppAt('/me');
    const completed = await screen.findByRole('list', { name: 'Completed tasks' });
    fakeTasksBackend.failRequests();

    await user.click(within(completed).getByRole('button', { name: 'Undo: Dust' }));

    expect(await within(completed).findByRole('alert')).toHaveTextContent("We couldn't undo this.");
  });
});
