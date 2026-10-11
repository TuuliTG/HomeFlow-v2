import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

/** Anna (an adult) adds a task for children and one for adults only; Ben, her child, logs in. */
function logInAsChild() {
  const anna = fakeAuthBackend.addProfile('anna@example.com', 'Anna');
  fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
  fakeTasksBackend.addTaskAs(anna.id, {
    title: 'Feed the cat',
    type: 'physical',
    points: 2,
    forChildren: true,
  });
  fakeTasksBackend.addTaskAs(anna.id, { title: 'Pay the bills', type: 'meta', points: 3 });
  const ben = fakeAuthBackend.logInAs('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  fakeHouseholdBackend.setChild(ben.id, true);
  return ben;
}

describe('tasks for children', () => {
  it('are the only tasks a child sees', async () => {
    logInAsChild();
    renderAppAt('/');

    expect(await screen.findByRole('listitem', { name: 'Feed the cat' })).toBeInTheDocument();
    expect(screen.queryByText('Pay the bills')).not.toBeInTheDocument();
  });

  it('are marked on the board for adults, who see every task', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Feed the cat',
      type: 'physical',
      points: 2,
      forChildren: true,
    });
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Pay the bills', type: 'meta', points: 3 });
    renderAppAt('/');

    const forChildren = await screen.findByRole('listitem', { name: 'Feed the cat' });
    expect(within(forChildren).getByText('For children')).toBeInTheDocument();
    const adultsOnly = screen.getByRole('listitem', { name: 'Pay the bills' });
    expect(within(adultsOnly).queryByText('For children')).not.toBeInTheDocument();
  });

  it('are chosen with a check mark when an adult adds a task, adults only by default', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    const forChildren = await screen.findByRole('checkbox', { name: 'Children can do it' });
    expect(forChildren).not.toBeChecked();
    await user.type(screen.getByLabelText('Task'), 'Tidy the toys');
    await user.click(forChildren);
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Tidy the toys' });
    expect(within(task).getByText('For children')).toBeInTheDocument();
    expect(tasks.at(-1)).toMatchObject({ title: 'Tidy the toys', forChildren: true });
  });

  it("aren't asked about for an adult's private task, which stays theirs alone", async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('checkbox', { name: 'Children can do it' }));
    await user.click(screen.getByRole('checkbox', { name: 'Keep it private' }));
    expect(screen.queryByRole('checkbox', { name: 'Children can do it' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Task'), 'Buy a present');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await screen.findByRole('heading', { level: 1, name: 'My tasks' });
    expect(tasks.at(-1)).toMatchObject({ isPrivate: true, forChildren: false });
  });

  it("are every task a child adds, so they aren't asked", async () => {
    logInAsChild();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Tidy my room');
    expect(screen.queryByRole('checkbox', { name: 'Children can do it' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(await screen.findByRole('listitem', { name: 'Tidy my room' })).toBeInTheDocument();
    expect(tasks.at(-1)).toMatchObject({ title: 'Tidy my room', forChildren: true });
  });

  it('can be changed when an adult edits a task', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Feed the cat',
      type: 'physical',
      points: 2,
      forChildren: true,
    });
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(await screen.findByRole('link', { name: 'Edit: Feed the cat' }));
    const forChildren = await screen.findByRole('checkbox', { name: 'Children can do it' });
    expect(forChildren).toBeChecked();
    await user.click(forChildren);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const task = await screen.findByRole('listitem', { name: 'Feed the cat' });
    expect(within(task).queryByText('For children')).not.toBeInTheDocument();
  });

  it('stay for children when a child edits one', async () => {
    logInAsChild();
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(await screen.findByRole('link', { name: 'Edit: Feed the cat' }));
    const title = await screen.findByLabelText('Task');
    expect(screen.queryByRole('checkbox', { name: 'Children can do it' })).not.toBeInTheDocument();
    await user.type(title, ' twice');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('listitem', { name: 'Feed the cat twice' })).toBeInTheDocument();
    expect(tasks[0]).toMatchObject({ forChildren: true });
  });
});
