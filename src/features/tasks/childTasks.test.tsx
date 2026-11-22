import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { addChildToFamily, logInAsFamilyMember } from '@/test/session';

/** Anna (an adult) gives Ben, her child, a task and adds one for adults only; Ben logs in. */
function logInAsChild() {
  const anna = fakeAuthBackend.addProfile('anna@example.com', 'Anna');
  fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
  const ben = fakeAuthBackend.logInAs('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  fakeHouseholdBackend.setChild(ben.id, true);
  fakeTasksBackend.addTaskAs(anna.id, {
    title: 'Feed the cat',
    type: 'physical',
    points: 2,
    forChildren: true,
    assignedTo: ben.id,
  });
  fakeTasksBackend.addTaskAs(anna.id, { title: 'Pay the bills', type: 'meta', points: 3 });
  return ben;
}

describe('tasks for children', () => {
  it('are the only tasks a child sees', async () => {
    logInAsChild();
    renderAppAt('/');

    expect(await screen.findByRole('listitem', { name: 'Feed the cat' })).toBeInTheDocument();
    expect(screen.queryByText('Pay the bills')).not.toBeInTheDocument();
  });

  it("aren't on the adults' board but on the child's page", async () => {
    const anna = logInAsFamilyMember();
    const ben = addChildToFamily();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Feed the cat',
      type: 'physical',
      points: 2,
      forChildren: true,
      assignedTo: ben.id,
    });
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Pay the bills', type: 'meta', points: 3 });
    renderAppAt('/');

    expect(await screen.findByRole('listitem', { name: 'Pay the bills' })).toBeInTheDocument();
    expect(screen.queryByText('Feed the cat')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Children' })).not.toBeInTheDocument();
  });

  it('are chosen first when an adult adds a task, for adults by default, then a child', async () => {
    logInAsFamilyMember();
    for (const [email, name] of [
      ['ben@example.com', 'Ben'],
      ['dora@example.com', 'Dora'],
    ] as const) {
      const child = fakeAuthBackend.addProfile(email, name);
      fakeHouseholdBackend.addMember(child.id, 'The Virtanens');
      fakeHouseholdBackend.setChild(child.id, true);
    }
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    const whoFor = await screen.findByRole('group', { name: 'Who is it for?' });
    expect(within(whoFor).getByRole('radio', { name: 'Adults' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Already done' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Type' })).toBeInTheDocument();
    await user.click(within(whoFor).getByRole('radio', { name: 'Children' }));

    // The child's own form adds it, so the rest of this one makes way, and it can't be private.
    expect(await screen.findByRole('list', { name: 'Whose task?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Private' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Task')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create task' })).not.toBeInTheDocument();
  });

  it('are worth the stars an adult picks, from none to five, without a hint', async () => {
    logInAsFamilyMember();
    const ben = addChildToFamily();
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}/new-task`);

    const stars = await screen.findByRole('radiogroup', { name: 'Stars' });
    expect(within(stars).getAllByRole('radio')).toHaveLength(5);
    await user.click(within(stars).getByRole('radio', { name: '2 stars' }));
    expect(within(stars).getByRole('radio', { name: '2 stars' })).toBeChecked();
    // Picking the same star again leaves none.
    await user.click(within(stars).getByRole('radio', { name: '2 stars' }));
    expect(within(stars).queryByRole('radio', { checked: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Not counted in statistics.')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Task'), 'Water the plants');
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    await screen.findByRole('heading', { level: 1, name: 'Ben' });
    expect(tasks.at(-1)).toMatchObject({ points: 0, forChildren: true });
  });

  it("aren't asked about for an adult's private task, which stays theirs alone", async () => {
    logInAsFamilyMember();
    addChildToFamily();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('button', { name: 'Private' }));
    await user.type(screen.getByLabelText('Task'), 'Buy a present');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await screen.findByRole('heading', { level: 1, name: 'My tasks' });
    expect(tasks.at(-1)).toMatchObject({ isPrivate: true, forChildren: false });
  });

  it("are every task a child adds, so they aren't asked", async () => {
    const ben = logInAsChild();
    fakeHouseholdBackend.setCanAddTasks(ben.id, true);
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Tidy my room');
    expect(screen.queryByRole('group', { name: 'Who is it for?' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(await screen.findByRole('listitem', { name: 'Tidy my room' })).toBeInTheDocument();
    expect(tasks.at(-1)).toMatchObject({
      title: 'Tidy my room',
      forChildren: true,
      assignedTo: ben.id,
    });
  });

  it('are edited by an adult with the same form as a new task for a child', async () => {
    const anna = logInAsFamilyMember();
    const ben = addChildToFamily();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Feed the cat',
      type: 'physical',
      points: 2,
      forChildren: true,
      assignedTo: ben.id,
    });
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}`);

    await user.click(await screen.findByRole('link', { name: /Feed the cat/ }));
    expect(await screen.findByRole('radio', { name: 'Custom' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: 'Adults' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '3 stars' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Ben' })).toBeInTheDocument();
    expect(tasks[0]).toMatchObject({ points: 3, forChildren: true, assignedTo: ben.id });
  });

  it('stay for children when a child edits one they added', async () => {
    const ben = logInAsChild();
    fakeHouseholdBackend.setCanAddTasks(ben.id, true);
    fakeTasksBackend.addTaskAs(ben.id, {
      title: 'Tidy my room',
      type: 'physical',
      points: null,
      forChildren: true,
      assignedTo: ben.id,
    });
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(await screen.findByRole('link', { name: 'Edit: Tidy my room' }));
    const title = await screen.findByLabelText('Task');
    expect(screen.queryByRole('group', { name: 'Who is it for?' })).not.toBeInTheDocument();
    await user.type(title, ' and desk');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByRole('listitem', { name: 'Tidy my room and desk' }),
    ).toBeInTheDocument();
    expect(tasks.at(-1)).toMatchObject({ forChildren: true, points: null });
  });

  it("become the child's own chore when a child makes their private task shared", async () => {
    const ben = logInAsChild();
    fakeHouseholdBackend.setCanAddTasks(ben.id, true);
    fakeTasksBackend.addTaskAs(ben.id, {
      title: 'Tidy my desk',
      type: 'physical',
      points: null,
      forChildren: true,
      isPrivate: true,
    });
    const user = userEvent.setup();
    renderAppAt('/me');

    await user.click(await screen.findByRole('link', { name: 'Edit: Tidy my desk' }));
    await user.click(await screen.findByRole('button', { name: 'Private' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('listitem', { name: 'Tidy my desk' })).toBeInTheDocument();
    expect(tasks.at(-1)).toMatchObject({
      isPrivate: false,
      forChildren: true,
      points: null,
      assignedTo: ben.id,
      pickedUpBy: ben.id,
    });
  });

  it("can't be made from a child's private task once the child may no longer add tasks", async () => {
    const ben = logInAsChild();
    fakeTasksBackend.addTaskAs(ben.id, {
      title: 'Tidy my desk',
      type: 'physical',
      points: null,
      forChildren: true,
      isPrivate: true,
    });
    const user = userEvent.setup();
    renderAppAt('/me');

    await user.click(await screen.findByRole('link', { name: 'Edit: Tidy my desk' }));
    await screen.findByLabelText('Task');
    expect(screen.queryByRole('button', { name: 'Private' })).not.toBeInTheDocument();
  });
});
