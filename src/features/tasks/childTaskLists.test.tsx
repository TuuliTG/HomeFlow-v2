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

    await user.click(await screen.findByRole('link', { name: 'Ben Child' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Ben' })).toBeInTheDocument();
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
    renderAppAt(`/household/members/${ben.id}`);

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
    renderAppAt(`/household/members/${ben.id}/new-task`);

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
    renderAppAt(`/household/members/${ben.id}`);

    await user.click(await screen.findByRole('link', { name: /Make the bed/ }));
    const name = await screen.findByLabelText('Task');
    await user.clear(name);
    await user.type(name, 'Make your bed');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Ben' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Make your bed/ })).toBeInTheDocument();
  });

  it('are set up by adults only', async () => {
    const { ben } = family();
    fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    renderAppAt(`/household/members/${ben.id}`);

    expect(await screen.findByRole('heading', { name: 'My stars' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Ben' })).not.toBeInTheDocument();
  });

  it('come back to the list after deleting one', async () => {
    const { anna, ben } = family();
    give(anna.id, ben.id, { title: 'Make the bed' });
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}`);

    await user.click(await screen.findByRole('link', { name: /Make the bed/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete task' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));

    expect(await screen.findByText('No tasks yet.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Ben' })).toBeInTheDocument();
  });

  it("are only a child's of the family", async () => {
    const { anna } = family();
    renderAppAt(`/household/members/${anna.id}`);

    expect(await screen.findByText("This member isn't in your family.")).toBeInTheDocument();
  });

  it('open an always task in the same form as a new one', async () => {
    const { anna, ben } = family();
    give(anna.id, ben.id, { title: 'Make the bed' });
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}`);

    await user.click(await screen.findByRole('link', { name: /Make the bed/ }));

    expect(await screen.findByRole('radio', { name: 'Always' })).toBeChecked();
    expect(screen.getByLabelText('Whose chore is it?')).toHaveDisplayValue('Ben');
    expect(screen.getByLabelText('Times a day, at most')).toHaveValue(1);
    expect(screen.getByRole('switch', { name: 'No limit' })).not.toBeChecked();
  });

  it('ask for a number of times a day unless there is no limit', async () => {
    const { ben } = family();
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}/new-task`);

    await user.type(await screen.findByRole('combobox', { name: 'Task' }), 'Brush teeth');
    await user.clear(screen.getByLabelText('Times a day, at most'));
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Choose 1 to 10 times a day, or no limit.');
    expect(screen.getByLabelText('Times a day, at most')).toHaveFocus();
  });

  it('copy the tasks chosen to another child, those they lack ticked to begin with', async () => {
    const { anna, ben, dora } = family();
    give(anna.id, ben.id, { title: 'Make the bed' });
    give(anna.id, ben.id, { title: 'Brush teeth' });
    give(anna.id, ben.id, { title: 'Read a book' });
    give(anna.id, dora.id, { title: 'Brush teeth' });
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}`);

    await user.click(await screen.findByRole('link', { name: 'Copy to Dora' }));
    expect(await screen.findByRole('heading', { name: 'Copy to Dora' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Make the bed/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Brush teeth/ })).toBeDisabled();
    expect(screen.getByText('Dora has it already')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Read a book/ }));
    await user.click(screen.getByRole('button', { name: 'Copy 1 task' }));

    expect(await screen.findByText('Copied to Dora.')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('heading', { level: 1, name: 'Ben' })).toBeInTheDocument();
    const doras = tasks.filter((task) => task.assignedTo === dora.id);
    expect(doras.map((task) => task.title).toSorted()).toEqual(['Brush teeth', 'Make the bed']);
    expect(doras.find((task) => task.title === 'Make the bed')).toMatchObject({
      isAlways: true,
      dailyLimit: 1,
      pickedUpBy: dora.id,
    });
  });

  it('offer no copying to a child who has all the tasks', async () => {
    const { anna, ben, dora } = family();
    give(anna.id, ben.id, { title: 'Brush teeth' });
    give(anna.id, dora.id, { title: 'Brush teeth' });
    renderAppAt(`/household/members/${ben.id}`);

    expect(await screen.findByRole('link', { name: /Brush teeth/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Copy to Dora' })).not.toBeInTheDocument();
  });

  it('copy nothing until a task is chosen, and say when copying fails', async () => {
    const { anna, ben, dora } = family();
    give(anna.id, ben.id, { title: 'Make the bed' });
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}/copy/${dora.id}`);

    await user.click(await screen.findByRole('checkbox', { name: /Make the bed/ }));
    expect(screen.getByRole('button', { name: 'Copy 0 tasks' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Make the bed/ }));
    fakeTasksBackend.failRequests();
    await user.click(screen.getByRole('button', { name: 'Copy 1 task' }));

    expect(await screen.findByText("We couldn't copy the tasks. Try again.")).toBeInTheDocument();
  });

  it("don't get a task the child has already", async () => {
    const { anna, ben } = family();
    give(anna.id, ben.id, { title: 'Brush teeth' });
    const count = tasks.length;
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}/new-task`);

    const name = await screen.findByRole('combobox', { name: 'Task' });
    await user.type(name, ' brush TEETH ');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Ben has this task already.');
    expect(name).toHaveFocus();
    expect(tasks).toHaveLength(count);
  });

  it("aren't offered a ready-made task the child has already", async () => {
    const { anna, ben } = family();
    give(anna.id, ben.id, { title: 'Tidy your room' });
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}/new-task`);

    await user.type(await screen.findByRole('combobox', { name: 'Task' }), 'your');
    const offered = () =>
      within(screen.getByRole('listbox', { name: 'Suggested tasks' }))
        .getAllByRole('option')
        .map((option) => option.textContent);
    expect(offered()).not.toContainEqual(expect.stringContaining('Tidy your room'));
    expect(offered()).toContainEqual(expect.stringContaining('Make your bed'));
  });

  it("can't be moved to a child who has the task already", async () => {
    const { anna, ben, dora } = family();
    give(anna.id, ben.id, { title: 'Make the bed' });
    give(anna.id, dora.id, { title: 'Make the bed' });
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}`);

    await user.click(await screen.findByRole('link', { name: /Make the bed/ }));
    await user.selectOptions(await screen.findByLabelText('Whose chore is it?'), 'Dora');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Dora has this task already.');
    expect(tasks.filter((task) => task.assignedTo === dora.id)).toHaveLength(1);
  });

  it('copy a name the child has twice only once', async () => {
    const { anna, ben, dora } = family();
    give(anna.id, ben.id, { title: 'Brush teeth' });
    give(anna.id, ben.id, { title: 'Brush teeth' });
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}/copy/${dora.id}`);

    await user.click(await screen.findByRole('button', { name: 'Copy 1 task' }));

    expect(await screen.findByText('Copied to Dora.')).toBeInTheDocument();
    expect(tasks.filter((task) => task.assignedTo === dora.id)).toHaveLength(1);
  });
});
