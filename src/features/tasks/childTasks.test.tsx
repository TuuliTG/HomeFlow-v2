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

  it("are listed apart on the adults' board, where adults can't do them", async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Feed the cat',
      type: 'physical',
      points: 2,
      forChildren: true,
    });
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Pay the bills', type: 'meta', points: 3 });
    const user = userEvent.setup();
    renderAppAt('/');

    const adultsOnly = await screen.findByRole('listitem', { name: 'Pay the bills' });
    expect(within(adultsOnly).queryByText('For children')).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Feed the cat' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: "Children's tasks" }));
    const forChildren = screen.getByRole('listitem', { name: 'Feed the cat' });
    // One list at a time: the adults' own tasks make way for the children's.
    expect(screen.queryByRole('listitem', { name: 'Pay the bills' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Picked up by' })).not.toBeInTheDocument();
    expect(within(forChildren).getByText('For children')).toBeInTheDocument();
    expect(
      within(forChildren).getByRole('link', { name: 'Edit: Feed the cat' }),
    ).toBeInTheDocument();
    expect(
      within(forChildren).queryByRole('button', { name: /^(Pick up|Mark done)/ }),
    ).not.toBeInTheDocument();
  });

  it('are listed on request even while the household has no tasks yet', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/');

    expect(await screen.findByText('No tasks yet. Create the first one!')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: "Children's tasks" }));

    expect(
      await screen.findByText('No tasks for children yet. Create the first one!'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No tasks yet. Create the first one!')).not.toBeInTheDocument();
  });

  it('are chosen first when an adult adds a task, for adults by default, and change the form', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    const { router } = renderAppAt('/tasks/new');

    const whoFor = await screen.findByRole('group', { name: 'Who is it for?' });
    expect(within(whoFor).getByRole('radio', { name: 'Adults' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Keep it private' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Already done' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Type' })).toBeInTheDocument();
    await user.click(within(whoFor).getByRole('radio', { name: 'Children' }));

    // Adults don't do it, so it is neither private, a type of their work, nor added as done.
    expect(screen.queryByRole('checkbox', { name: 'Keep it private' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Already done' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Type' })).not.toBeInTheDocument();
    const stars = screen.getByLabelText('Stars for each child');
    await user.clear(stars);
    await user.type(stars, '2');
    await user.type(screen.getByLabelText('Task'), 'Tidy the toys');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    // The board opens on the children's tasks, where it shows.
    const task = await screen.findByRole('listitem', { name: 'Tidy the toys' });
    expect(screen.getByRole('radio', { name: "Children's tasks" })).toBeChecked();
    expect(within(task).getByText('For children')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?children=1');
    expect(tasks.at(-1)).toMatchObject({ title: 'Tidy the toys', forChildren: true, points: 2 });
  });

  it("aren't asked about for an adult's private task, which stays theirs alone", async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('radio', { name: 'Children' }));
    await user.click(screen.getByRole('radio', { name: 'Adults' }));
    await user.click(screen.getByRole('checkbox', { name: 'Keep it private' }));
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
    renderAppAt('/?children=1');

    await user.click(await screen.findByRole('link', { name: 'Edit: Feed the cat' }));
    const forChildren = await screen.findByRole('radio', { name: 'Children' });
    expect(forChildren).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Adults' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const task = await screen.findByRole('listitem', { name: 'Feed the cat' });
    expect(within(task).queryByText('For children')).not.toBeInTheDocument();
    expect(within(task).getByRole('button', { name: 'Pick up: Feed the cat' })).toBeInTheDocument();
  });

  it('stay for children when a child edits one they added', async () => {
    const ben = logInAsChild();
    fakeHouseholdBackend.setCanAddTasks(ben.id, true);
    fakeTasksBackend.addTaskAs(ben.id, {
      title: 'Tidy my room',
      type: 'physical',
      points: null,
      forChildren: true,
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
});
