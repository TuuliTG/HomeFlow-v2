import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

const TRASH = { title: 'Take out trash', type: 'physical', points: 1 } as const;

function addBen() {
  const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  return ben;
}

describe('adding a task again', () => {
  it('offers the most often added tasks and adds one again with the same details', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    fakeTasksBackend.addTaskAs(anna.id, {
      ...TRASH,
      description: 'The bins are behind the garage',
    });
    fakeTasksBackend.addTaskAs(anna.id, TRASH);
    fakeTasksBackend.completeTaskAs(anna.id, 'task:1', '2026-10-08');
    fakeTasksBackend.completeTaskAs(anna.id, 'task:2', '2026-10-08');
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    const recent = await screen.findByRole('region', { name: 'Add again' });
    const buttons = await within(recent).findAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Take out trash · 1 point',
      'Vacuum · 3 points',
    ]);
    await user.click(buttons[0] ?? recent);

    expect(screen.getByLabelText('Task')).toHaveValue('Take out trash');
    expect(screen.getByLabelText('Points')).toHaveValue(1);
    expect(screen.getByRole('radio', { name: 'Physical' })).toBeChecked();
    expect(screen.queryByRole('region', { name: 'Add again' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Take out trash' });
    expect(within(task).getByText(/^1 points?$/)).toBeInTheDocument();
  });

  it('lists earlier tasks that match the name being typed', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, TRASH);
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Sort the trash', type: 'meta', points: 2 });
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByRole('combobox', { name: 'Task' }), 'tras');

    const options = await within(await screen.findByRole('listbox')).findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      // Both added once; the newer one, or by name when added in the same millisecond.
      'Sort the trashOn the board · 2 points',
      'Take out trashOn the board · 1 point',
    ]);
    await user.click(options[0] ?? document.body);

    expect(screen.getByLabelText('Task')).toHaveValue('Sort the trash');
    expect(screen.getByRole('radio', { name: 'Meta work' })).toBeChecked();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('can pick an earlier task with the keyboard without saving it', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, TRASH);
    const user = userEvent.setup();
    renderAppAt('/tasks/new');
    const title = await screen.findByRole('combobox', { name: 'Task' });

    await user.type(title, 'take');
    await screen.findByRole('option', { name: /Take out trash/ });
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: /Take out trash/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.keyboard('{Enter}');

    expect(title).toHaveValue('Take out trash');
    expect(screen.getByRole('heading', { level: 1, name: 'New task' })).toBeInTheDocument();
  });

  it('closes the list with Escape', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, TRASH);
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByRole('combobox', { name: 'Task' }), 'take');
    await screen.findByRole('option', { name: /Take out trash/ });
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('keeps how often the task repeats but not its due date', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { ...TRASH, repeatEveryDays: 7, dueOn: '2026-10-01' });
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('button', { name: /Take out trash/ }));

    expect(screen.getByLabelText('Repeats')).toHaveValue('7');
    expect(screen.getByLabelText('Due date')).toHaveValue('');
  });

  it('says when the task picked is already on the board', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, TRASH);
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('button', { name: /Take out trash/ }));
    expect(screen.getByText(/Take out trash is already on the board/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Task'), ' and recycling');
    expect(screen.queryByText(/is already on the board/)).not.toBeInTheDocument();
  });

  it("suggests the user's own private tasks as private, but not other members'", async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Buy a present',
      type: 'meta',
      points: null,
      isPrivate: true,
    });
    fakeTasksBackend.addTaskAs(ben.id, {
      title: 'Plan a surprise',
      type: 'meta',
      points: null,
      isPrivate: true,
    });
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    const recent = await screen.findByRole('region', { name: 'Add again' });
    expect(
      within(recent)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Buy a present · Private']);
    await user.click(within(recent).getByRole('button'));

    expect(screen.getByRole('checkbox', { name: 'Keep it private' })).toBeChecked();
    expect(screen.queryByLabelText('Points')).not.toBeInTheDocument();
  });

  it("doesn't suggest a task that was deleted", async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, TRASH);
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Added by mistake', type: 'meta', points: 1 });
    const user = userEvent.setup();
    renderAppAt('/');

    const mistake = await screen.findByRole('listitem', { name: 'Added by mistake' });
    await user.click(within(mistake).getByRole('link', { name: /Edit/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete task' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await screen.findByRole('heading', { level: 1, name: 'Shared tasks' });
    await user.click(screen.getByRole('link', { name: 'New task' }));

    const recent = await screen.findByRole('region', { name: 'Add again' });
    expect(
      within(recent)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Take out trash · 1 point']);
  });

  it('offers nothing when the household has added no tasks yet', async () => {
    logInAsFamilyMember();
    renderAppAt('/tasks/new');

    await screen.findByLabelText('Task');
    expect(screen.queryByRole('region', { name: 'Add again' })).not.toBeInTheDocument();
  });

  it('offers nothing when editing a task', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, TRASH);
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/edit');

    await user.clear(await screen.findByDisplayValue('Take out trash'));
    expect(screen.queryByRole('region', { name: 'Add again' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Task'), 'Take');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('adds a completed task again from the board', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      ...TRASH,
      description: 'The bins are behind the garage',
    });
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-08');
    const user = userEvent.setup();
    renderAppAt('/?completed=1');

    await user.click(await screen.findByRole('link', { name: 'Add Take out trash again' }));

    expect(await screen.findByLabelText('Task')).toHaveValue('Take out trash');
    expect(screen.getByLabelText('Description (optional)')).toHaveValue(
      'The bins are behind the garage',
    );
    expect(screen.getByLabelText('Points')).toHaveValue(1);
  });
});
