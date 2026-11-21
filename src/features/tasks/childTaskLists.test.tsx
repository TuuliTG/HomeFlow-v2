import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
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

/** Anna gives a child a task, always there unless it repeats. */
function give(annaId: string, childId: string, task: { title: string; repeatEveryDays?: number }) {
  const repeatEveryDays = task.repeatEveryDays ?? null;
  return fakeTasksBackend.addTaskAs(annaId, {
    title: task.title,
    type: 'physical',
    points: 1,
    forChildren: true,
    assignedTo: childId,
    isAlways: repeatEveryDays === null,
    dailyLimit: repeatEveryDays === null ? 1 : null,
    repeatEveryDays,
  });
}

describe("a child's tasks", () => {
  it('open from the family page, the always ones first', async () => {
    const { anna, ben, dora } = family();
    give(anna.id, ben.id, { title: 'Make the bed' });
    give(anna.id, ben.id, { title: 'Take out the bins', repeatEveryDays: 7 });
    give(anna.id, dora.id, { title: 'Feed the cat' });
    const user = userEvent.setup();
    renderAppAt('/household');

    await user.click(await screen.findByRole('link', { name: "Ben's tasks" }));

    expect(await screen.findByRole('heading', { name: "Ben's tasks" })).toBeInTheDocument();
    const always = screen.getByRole('list', { name: 'Always' });
    expect(within(always).getByRole('link', { name: /Make the bed/ })).toHaveTextContent(
      '1× a day',
    );
    const custom = screen.getByRole('list', { name: 'Custom' });
    expect(within(custom).getByRole('link', { name: /Take out the bins/ })).toHaveTextContent(
      'Every week',
    );
    expect(screen.queryByText('Feed the cat')).not.toBeInTheDocument();
  });

  it('get an always task from the short form, once a day to begin with', async () => {
    const { ben } = family();
    const user = userEvent.setup();
    renderAppAt(`/children/${ben.id}/tasks`);

    await user.click(await screen.findByRole('link', { name: 'Add a task for Ben' }));
    expect(await screen.findByRole('heading', { name: 'New task for Ben' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Always' })).toBeChecked();
    expect(screen.queryByLabelText('Repeats')).not.toBeInTheDocument();
    await user.type(screen.getByRole('combobox', { name: 'Task' }), 'Brush teeth');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const always = await screen.findByRole('list', { name: 'Always' });
    expect(within(always).getByRole('link', { name: /Brush teeth/ })).toBeInTheDocument();
    expect(tasks.at(-1)).toMatchObject({
      title: 'Brush teeth',
      forChildren: true,
      assignedTo: ben.id,
      isAlways: true,
      dailyLimit: 1,
      points: 1,
    });
  });

  it('get a custom task that repeats', async () => {
    const { ben } = family();
    const user = userEvent.setup();
    renderAppAt(`/children/${ben.id}/tasks/new`);

    await user.click(await screen.findByRole('radio', { name: 'Custom' }));
    await user.type(screen.getByRole('combobox', { name: 'Task' }), 'Water the plants');
    await user.selectOptions(screen.getByLabelText('Repeats'), '3');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const custom = await screen.findByRole('list', { name: 'Custom' });
    expect(within(custom).getByRole('link', { name: /Water the plants/ })).toBeInTheDocument();
    expect(tasks.at(-1)).toMatchObject({
      assignedTo: ben.id,
      isAlways: false,
      dailyLimit: null,
      repeatEveryDays: 3,
    });
  });

  it('open to edit and come back to the list', async () => {
    const { anna, ben } = family();
    give(anna.id, ben.id, { title: 'Make the bed' });
    const user = userEvent.setup();
    renderAppAt(`/children/${ben.id}/tasks`);

    await user.click(await screen.findByRole('link', { name: /Make the bed/ }));
    const name = await screen.findByLabelText('Task');
    await user.clear(name);
    await user.type(name, 'Make your bed');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { name: "Ben's tasks" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Make your bed/ })).toBeInTheDocument();
  });

  it('copy to another child, only those they lack', async () => {
    const { anna, ben, dora } = family();
    give(anna.id, ben.id, { title: 'Make the bed' });
    give(anna.id, ben.id, { title: 'Brush teeth' });
    give(anna.id, dora.id, { title: 'Brush teeth' });
    const user = userEvent.setup();
    renderAppAt(`/children/${ben.id}/tasks`);

    await user.click(await screen.findByRole('button', { name: 'Copy to Dora' }));

    expect(await screen.findByText('Copied to Dora.')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('button', { name: 'Copy to Dora' })).not.toBeInTheDocument();
    const doras = tasks.filter((task) => task.assignedTo === dora.id);
    expect(doras.map((task) => task.title).toSorted()).toEqual(['Brush teeth', 'Make the bed']);
    expect(doras.find((task) => task.title === 'Make the bed')).toMatchObject({
      isAlways: true,
      dailyLimit: 1,
      pickedUpBy: dora.id,
    });
  });

  it('are set up by adults only', async () => {
    const { ben } = family();
    fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    renderAppAt(`/children/${ben.id}/tasks`);

    expect(await screen.findByRole('heading', { name: 'My stars' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: "Ben's tasks" })).not.toBeInTheDocument();
  });

  it('come back to the list after deleting one', async () => {
    const { anna, ben } = family();
    give(anna.id, ben.id, { title: 'Make the bed' });
    const user = userEvent.setup();
    renderAppAt(`/children/${ben.id}/tasks`);

    await user.click(await screen.findByRole('link', { name: /Make the bed/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete task' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));

    expect(await screen.findByText('No tasks yet.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Ben's tasks" })).toBeInTheDocument();
  });

  it("are only a child's of the family", async () => {
    const { anna } = family();
    renderAppAt(`/children/${anna.id}/tasks`);

    expect(await screen.findByText('This child is not in your family.')).toBeInTheDocument();
  });

  it('say when copying fails', async () => {
    const { anna, ben } = family();
    give(anna.id, ben.id, { title: 'Make the bed' });
    const user = userEvent.setup();
    renderAppAt(`/children/${ben.id}/tasks`);

    const copy = await screen.findByRole('button', { name: 'Copy to Dora' });
    fakeTasksBackend.failRequests();
    await user.click(copy);

    expect(await screen.findByText("We couldn't copy the tasks. Try again.")).toBeInTheDocument();
  });

  it('copy a name the child has twice only once', async () => {
    const { anna, ben, dora } = family();
    give(anna.id, ben.id, { title: 'Brush teeth' });
    give(anna.id, ben.id, { title: 'Brush teeth' });
    const user = userEvent.setup();
    renderAppAt(`/children/${ben.id}/tasks`);

    await user.click(await screen.findByRole('button', { name: 'Copy to Dora' }));

    expect(await screen.findByText('Copied to Dora.')).toBeInTheDocument();
    expect(tasks.filter((task) => task.assignedTo === dora.id)).toHaveLength(1);
  });
});
