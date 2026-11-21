import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ALWAYS_TASK_PAUSE_MS } from '@/features/tasks/task';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { creditsOf, fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';
import { today } from '@/lib/dates';

/** Anna (an adult) and her child Ben, both in the household; nobody is logged in yet. */
function family() {
  const anna = fakeAuthBackend.addProfile('anna@example.com', 'Anna');
  fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
  const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  fakeHouseholdBackend.setChild(ben.id, true);
  return { anna, ben };
}

/** Anna gives Ben an always task, earning one star. */
function addAlwaysTask(
  annaId: string,
  benId: string,
  task: { title: string; dailyLimit: number | null },
) {
  return fakeTasksBackend.addTaskAs(annaId, {
    ...task,
    type: 'physical',
    points: 1,
    forChildren: true,
    assignedTo: benId,
    isAlways: true,
  });
}

describe('always tasks', () => {
  it('are added by an adult for a child, once a day unless they choose otherwise', async () => {
    const anna = logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(ben.id, true);
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('radio', { name: 'Children' }));
    await user.type(screen.getByLabelText('Task'), 'Brush teeth');
    expect(screen.getByLabelText('Repeats')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /^Always there/ }));
    // An always task is never due and never repeats.
    expect(screen.queryByLabelText('Repeats')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Due date')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Times a day')).toHaveDisplayValue('1');
    await user.selectOptions(screen.getByLabelText('Times a day'), '2');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Brush teeth' });
    expect(within(task).getByText('Always · 2× a day')).toBeInTheDocument();
    expect(tasks.at(-1)).toMatchObject({
      createdBy: anna.id,
      assignedTo: ben.id,
      isAlways: true,
      dailyLimit: 2,
      repeatEveryDays: null,
      dueOn: null,
    });
  });

  it('can have no limit', async () => {
    logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(ben.id, true);
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('radio', { name: 'Children' }));
    await user.type(screen.getByLabelText('Task'), 'Tidy toys');
    await user.click(screen.getByRole('checkbox', { name: /^Always there/ }));
    await user.selectOptions(screen.getByLabelText('Times a day'), 'No limit');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(
      within(await screen.findByRole('listitem', { name: 'Tidy toys' })).getByText('Always'),
    ).toBeInTheDocument();
    expect(tasks.at(-1)).toMatchObject({ isAlways: true, dailyLimit: null });
  });

  it("are not offered for adults' tasks", async () => {
    logInAsFamilyMember();
    renderAppAt('/tasks/new');

    expect(await screen.findByLabelText('Task')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /^Always there/ })).not.toBeInTheDocument();
  });

  it('rest for a moment after the child marks one done, then come back', async () => {
    const { anna, ben } = family();
    addAlwaysTask(anna.id, ben.id, { title: 'Brush teeth', dailyLimit: null });
    fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(await screen.findByRole('button', { name: 'Mark done: Brush teeth' }));

    expect(await screen.findByRole('img', { name: 'Done: Brush teeth' })).toBeInTheDocument();
    expect(tasks.flatMap(creditsOf)).toEqual([{ userId: ben.id, points: 1 }]);
    expect(tasks.at(-1)).toMatchObject({ isAlways: true, pickedUpBy: ben.id, completed: null });
  });

  it('can be done again once the pause is over', async () => {
    const { anna, ben } = family();
    const id = addAlwaysTask(anna.id, ben.id, { title: 'Brush teeth', dailyLimit: null });
    fakeTasksBackend.completeTaskAs(ben.id, id, today());
    fakeTasksBackend.ageCompletions(ALWAYS_TASK_PAUSE_MS);
    fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    renderAppAt('/');

    expect(
      await screen.findByRole('button', { name: 'Mark done: Brush teeth' }),
    ).not.toBeDisabled();
  });

  it('stay done for the day once done as often as their limit allows', async () => {
    const { anna, ben } = family();
    const id = addAlwaysTask(anna.id, ben.id, { title: 'Make the bed', dailyLimit: 1 });
    fakeTasksBackend.completeTaskAs(ben.id, id, today());
    fakeTasksBackend.ageCompletions(ALWAYS_TASK_PAUSE_MS);
    fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    renderAppAt('/');

    expect(await screen.findByRole('img', { name: 'Done: Make the bed' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Mark done: Make the bed' }),
    ).not.toBeInTheDocument();
  });

  it("keep their place on the child's page after being done", async () => {
    const { anna, ben } = family();
    const bed = addAlwaysTask(anna.id, ben.id, { title: 'Make the bed', dailyLimit: null });
    addAlwaysTask(anna.id, ben.id, { title: 'Brush teeth', dailyLimit: null });
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Pack for the trip',
      type: 'physical',
      points: 3,
      forChildren: true,
      assignedTo: ben.id,
    });
    fakeTasksBackend.completeTaskAs(ben.id, bed, today());
    fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    renderAppAt('/');

    const mine = await screen.findByRole('list', { name: 'My tasks' });
    expect(
      within(mine)
        .getAllByRole('heading')
        .map((heading) => heading.textContent),
    ).toEqual(['Pack for the trip', 'Brush teeth', 'Make the bed']);
  });

  it("are one child's: editing one for any child asks for a child", async () => {
    const anna = logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(ben.id, true);
    const id = addAlwaysTask(anna.id, ben.id, { title: 'Brush teeth', dailyLimit: 1 });
    const user = userEvent.setup();
    renderAppAt(`/tasks/${id}/edit`);

    await user.selectOptions(await screen.findByLabelText('Whose chore is it?'), 'Any child');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose at least one child.');
    expect(tasks[0]).toMatchObject({ assignedTo: ben.id });
  });

  it('have no repeat or due date when a child edits one they added', async () => {
    const { ben } = family();
    const id = fakeTasksBackend.addTaskAs(ben.id, {
      title: 'Read a book',
      type: 'physical',
      points: 1,
      forChildren: true,
      assignedTo: ben.id,
      isAlways: true,
    });
    fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    renderAppAt(`/tasks/${id}/edit`);

    expect(await screen.findByLabelText('Task')).toHaveValue('Read a book');
    expect(screen.queryByLabelText('Repeats')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Due date')).not.toBeInTheDocument();
  });

  it('cannot be picked up while resting after another child did one', async () => {
    const { anna, ben } = family();
    const dora = fakeAuthBackend.addProfile('dora@example.com', 'Dora');
    fakeHouseholdBackend.addMember(dora.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(dora.id, true);
    const id = fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Feed the cat',
      type: 'physical',
      points: 1,
      forChildren: true,
      isAlways: true,
    });
    fakeTasksBackend.completeTaskAs(ben.id, id, today());
    fakeAuthBackend.logInAs('dora@example.com', 'Dora');
    renderAppAt('/');

    expect(await screen.findByRole('img', { name: 'Done: Feed the cat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pick up: Feed the cat' })).not.toBeInTheDocument();
  });
});
