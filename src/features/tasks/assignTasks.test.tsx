import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { creditsOf, fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
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
  it('is offered for a task for children, and picks it up for the child chosen', async () => {
    const { ben } = family();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Make your bed');
    expect(screen.queryByRole('group', { name: 'Which children?' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Children' }));
    const which = await screen.findByRole('group', { name: 'Which children?' });
    expect(within(which).getByRole('checkbox', { name: 'Ben' })).not.toBeChecked();
    await user.click(within(which).getByRole('checkbox', { name: 'Ben' }));
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    // Ben's page opens, where it shows.
    expect(
      await screen.findByRole('heading', { level: 1, name: "Ben's tasks" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Make your bed/ })).toBeInTheDocument();
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
    await user.click(screen.getByRole('radio', { name: '2 stars' }));
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await screen.findByRole('link', { name: /Empty the dishwasher/ });
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

  it('needs at least one child chosen', async () => {
    family();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('radio', { name: 'Children' }));
    await screen.findByRole('group', { name: 'Which children?' });
    await user.type(screen.getByLabelText('Task'), 'Make your bed');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose at least one child.');
    const ben = screen.getByRole('checkbox', { name: 'Ben' });
    expect(ben).toHaveFocus();
    expect(ben).toBeInvalid();
    await user.click(ben);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(tasks).toHaveLength(0);
  });

  it('chooses the only child of the family already', async () => {
    const anna = logInAsFamilyMember();
    const ben = addChildToFamily();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('radio', { name: 'Children' }));
    const which = await screen.findByRole('group', { name: 'Which children?' });
    expect(within(which).getByRole('checkbox', { name: 'Ben' })).toBeChecked();
    await user.type(screen.getByLabelText('Task'), 'Make your bed');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await screen.findByRole('link', { name: /Make your bed/ });
    expect(tasks.at(-1)).toMatchObject({ createdBy: anna.id, assignedTo: ben.id });
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

    expect(
      await screen.findByRole('heading', { level: 1, name: "Dora's tasks" }),
    ).toBeInTheDocument();
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

    await screen.findByLabelText('Task');
    expect(screen.queryByRole('group', { name: 'Who is it for?' })).not.toBeInTheDocument();
  });
});
