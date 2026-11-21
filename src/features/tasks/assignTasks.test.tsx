import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { addChildToFamily, logInAsFamilyMember } from '@/test/session';

/** Anna (an adult, logged in) and her children Ben and Dora. */
function family() {
  const anna = logInAsFamilyMember();
  const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
  const dora = fakeAuthBackend.addProfile('dora@example.com', 'Dora');
  for (const child of [ben, dora]) {
    fakeHouseholdBackend.addMember(child.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(child.id, true);
  }
  return { anna, ben, dora };
}

function logInAs(email: string, name: string) {
  fakeAuthBackend.logInAs(email, name);
}

describe('giving a task to one child', () => {
  it("is given from the child's own form, chosen from the children, which then opens their page", async () => {
    const { ben } = family();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('radio', { name: 'Children' }));
    const whose = await screen.findByRole('list', { name: 'Whose task?' });
    expect(
      within(whose)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Ben', 'Dora']);
    expect(screen.queryByLabelText('Task')).not.toBeInTheDocument();
    await user.click(within(whose).getByRole('link', { name: 'Ben' }));

    expect(await screen.findByRole('heading', { name: 'New task for Ben' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Custom' }));
    await user.type(screen.getByRole('combobox', { name: 'Task' }), 'Make your bed');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    // Ben's page opens, where it shows.
    expect(await screen.findByRole('heading', { level: 1, name: 'Ben' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Make your bed/ })).toBeInTheDocument();
    expect(tasks.at(-1)).toMatchObject({ assignedTo: ben.id, pickedUpBy: ben.id });
  });

  it("opens the only child's form at once", async () => {
    logInAsFamilyMember();
    addChildToFamily();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('radio', { name: 'Children' }));

    expect(await screen.findByRole('heading', { name: 'New task for Ben' })).toBeInTheDocument();
  });

  it("puts the task on the child's Me page and hides it from the other children", async () => {
    const { anna, ben, dora } = family();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Make your bed',
      type: 'physical',
      points: 1,
      forChildren: true,
      assignedTo: ben.id,
    });
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Feed the cat',
      type: 'physical',
      points: 2,
      forChildren: true,
      assignedTo: dora.id,
    });

    logInAs('ben@example.com', 'Ben');
    const { unmount } = renderAppAt('/me');
    const myTasks = await screen.findByRole('list', { name: 'My tasks' });
    expect(
      within(myTasks).getByRole('button', { name: 'Mark done: Make your bed' }),
    ).toBeInTheDocument();
    unmount();

    logInAs('dora@example.com', 'Dora');
    renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Feed the cat' });
    expect(screen.queryByText('Make your bed')).not.toBeInTheDocument();
  });

  it('can be given to another child by editing it, but not to no one', async () => {
    const { anna, ben, dora } = family();
    const id = fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Make your bed',
      type: 'physical',
      points: 1,
      forChildren: true,
      assignedTo: ben.id,
    });
    const user = userEvent.setup();
    renderAppAt(`/tasks/${id}/edit`);

    const whose = await screen.findByLabelText('Whose chore is it?');
    expect(whose).toHaveDisplayValue('Ben');
    expect(
      within(whose)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Ben', 'Dora']);
    await user.selectOptions(whose, 'Dora');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Dora' })).toBeInTheDocument();
    expect(tasks.find((candidate) => candidate.id === id)).toMatchObject({
      assignedTo: dora.id,
      pickedUpBy: dora.id,
    });
  });

  it('goes with a child who becomes an adult', () => {
    const { anna, ben } = family();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Make your bed',
      type: 'physical',
      points: 1,
      forChildren: true,
      assignedTo: ben.id,
    });
    fakeHouseholdBackend.setChild(ben.id, false);

    expect(tasks).toHaveLength(0);
  });

  it('stays given to the child when they edit a task they added', async () => {
    const { ben } = family();
    fakeHouseholdBackend.setCanAddTasks(ben.id, true);
    const id = fakeTasksBackend.addTaskAs(ben.id, {
      title: 'Tidy my room',
      type: 'physical',
      points: null,
      forChildren: true,
      assignedTo: ben.id,
    });
    logInAs('ben@example.com', 'Ben');
    const user = userEvent.setup();
    renderAppAt(`/tasks/${id}/edit`);

    await user.type(await screen.findByLabelText('Task'), ' and desk');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(tasks[0]).toMatchObject({ title: 'Tidy my room and desk', assignedTo: ben.id });
    });
  });

  it("isn't offered without children in the household", async () => {
    logInAsFamilyMember();
    renderAppAt('/tasks/new');

    expect(await screen.findByLabelText('Task')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Who is it for?' })).not.toBeInTheDocument();
  });

  it("isn't offered when editing an adults' task", async () => {
    const { anna } = family();
    const id = fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Pay the bills',
      type: 'meta',
      points: 3,
    });
    renderAppAt(`/tasks/${id}/edit`);

    expect(await screen.findByLabelText('Task')).toHaveValue('Pay the bills');
    expect(screen.queryByRole('group', { name: 'Who is it for?' })).not.toBeInTheDocument();
  });
});
