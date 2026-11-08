import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { creditsOf, fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

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
  it('is offered for a task for children, and picks it up for the child chosen', async () => {
    const { ben } = family();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Make your bed');
    expect(screen.queryByRole('group', { name: 'Which children?' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Children' }));
    const which = await screen.findByRole('group', { name: 'Which children?' });
    expect(which).toHaveAccessibleDescription(/Choose none and any child can pick it up/);
    await user.click(within(which).getByRole('checkbox', { name: 'Ben' }));
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Make your bed' });
    expect(within(task).getByText('Only for Ben')).toBeInTheDocument();
    expect(within(task).getByText('Picked up by Ben')).toBeInTheDocument();
    expect(tasks.at(-1)).toMatchObject({ assignedTo: ben.id, pickedUpBy: ben.id });
  });

  it('adds a copy for each child chosen, who each earn its stars', async () => {
    const { ben, dora } = family();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('radio', { name: 'Children' }));
    const which = await screen.findByRole('group', { name: 'Which children?' });
    await user.click(within(which).getByRole('checkbox', { name: 'Ben' }));
    await user.click(within(which).getByRole('checkbox', { name: 'Dora' }));
    await user.type(screen.getByLabelText('Task'), 'Empty the dishwasher');
    await user.clear(screen.getByLabelText('Stars for each child'));
    await user.type(screen.getByLabelText('Stars for each child'), '2');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const childrens = await screen.findByRole('region', { name: "Children's tasks" });
    const copies = within(childrens).getAllByRole('listitem', { name: 'Empty the dishwasher' });
    expect(copies.map((copy) => within(copy).getByText(/^Only for/).textContent).sort()).toEqual([
      'Only for Ben',
      'Only for Dora',
    ]);
    expect(tasks.slice(-2)).toMatchObject([
      { assignedTo: ben.id, pickedUpBy: ben.id, points: 2 },
      { assignedTo: dora.id, pickedUpBy: dora.id, points: 2 },
    ]);

    // Doing it together, each marks their own copy done and earns the stars.
    const [bens, doras] = tasks.slice(-2);
    fakeTasksBackend.completeTaskAs(ben.id, bens?.id ?? '', '2026-10-11');
    fakeTasksBackend.completeTaskAs(dora.id, doras?.id ?? '', '2026-10-11');
    expect(tasks.slice(-2).flatMap(creditsOf)).toEqual([
      { userId: ben.id, points: 2 },
      { userId: dora.id, points: 2 },
    ]);
  });

  it("puts the task on the child's Me page and hides it from the other children", async () => {
    const { anna, ben } = family();
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

  it('can be undone by editing the task, which puts it back for any child', async () => {
    const { anna, ben } = family();
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
    await user.selectOptions(whose, 'Any child');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const task = await screen.findByRole('listitem', { name: 'Make your bed' });
    expect(within(task).getByText('For children')).toBeInTheDocument();
    expect(within(task).queryByText(/Picked up by/)).not.toBeInTheDocument();
    expect(tasks.find((candidate) => candidate.id === id)).toMatchObject({
      assignedTo: null,
      pickedUpBy: null,
    });
  });

  it('is no longer given to a child who becomes an adult, who gives it back', async () => {
    const { anna, ben } = family();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Make your bed',
      type: 'physical',
      points: 1,
      forChildren: true,
      assignedTo: ben.id,
    });
    fakeHouseholdBackend.setChild(ben.id, false);
    renderAppAt('/?children=1');

    const task = await screen.findByRole('listitem', { name: 'Make your bed' });
    expect(within(task).getByText('For children')).toBeInTheDocument();
    expect(within(task).queryByText(/Picked up by/)).not.toBeInTheDocument();
  });

  it('stays given to the child when they edit a task they added', async () => {
    const { ben } = family();
    fakeHouseholdBackend.setCanAddTasks(ben.id, true);
    const id = fakeTasksBackend.addTaskAs(ben.id, {
      title: 'Tidy my room',
      type: 'physical',
      points: null,
      forChildren: true,
    });
    // As if Anna had given it to him since.
    Object.assign(tasks.find((task) => task.id === id) ?? {}, {
      assignedTo: ben.id,
      pickedUpBy: ben.id,
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
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('radio', { name: 'Children' }));
    expect(screen.queryByRole('group', { name: 'Which children?' })).not.toBeInTheDocument();
  });
});
