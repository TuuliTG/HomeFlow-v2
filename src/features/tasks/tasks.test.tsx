import { screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksApi';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

const POINTS_ERROR = 'Points must be a whole number from 1 to 10.';

async function fillInTask(user: UserEvent, title: string, points = '3') {
  await user.type(await screen.findByLabelText('Task'), title);
  await user.clear(screen.getByLabelText('Points'));
  await user.type(screen.getByLabelText('Points'), points);
  await user.click(screen.getByRole('button', { name: 'Create task' }));
}

describe('task board', () => {
  it("shows the household's tasks, newest first, with who added them", async () => {
    const anna = logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    fakeTasksBackend.addTaskAs(ben.id, { title: 'Book dentist', type: 'planning', points: 5 });
    renderAppAt('/');

    const tasks = await screen.findAllByRole('listitem', { name: /Vacuum|Book dentist/ });
    expect(tasks.map((task) => within(task).getByRole('heading').textContent)).toEqual([
      'Book dentist',
      'Vacuum',
    ]);
    expect(tasks.map((task) => within(task).getByText(/^Added by/).textContent)).toEqual([
      'Added by Ben',
      'Added by you',
    ]);
  });

  it('credits members without a name as someone', async () => {
    logInAsFamilyMember();
    fakeHouseholdBackend.addMember('user:ben@example.com', 'The Virtanens');
    fakeTasksBackend.addTaskAs('user:ben@example.com', {
      title: 'Dust',
      type: 'physical',
      points: 2,
    });
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Dust' });
    expect(within(task).getByText('Added by someone')).toBeInTheDocument();
  });

  it("doesn't show other households' tasks", async () => {
    const carol = fakeAuthBackend.addProfile('carol@example.com', 'Carol');
    fakeHouseholdBackend.addMember(carol.id, "Carol's flat");
    fakeTasksBackend.addTaskAs(carol.id, { title: 'Secret', type: 'physical', points: 1 });
    logInAsFamilyMember();
    renderAppAt('/');

    expect(await screen.findByText('No tasks yet. Create the first one!')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('explains when the tasks cannot be loaded', async () => {
    logInAsFamilyMember();
    fakeTasksBackend.failRequests();
    renderAppAt('/');

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the tasks.");
  });
});

describe('creating a task', () => {
  beforeEach(() => {
    logInAsFamilyMember();
  });

  it('adds a new task to the available tasks list', async () => {
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(await screen.findByRole('link', { name: 'New task' }));
    expect(screen.getByRole('heading', { level: 1, name: 'New task' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Task'), '  Book dentist  ');
    await user.click(screen.getByRole('radio', { name: 'Planning' }));
    await user.clear(screen.getByLabelText('Points'));
    await user.type(screen.getByLabelText('Points'), '5');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Book dentist' });
    expect(screen.getByRole('heading', { level: 1, name: 'Available tasks' })).toBeInTheDocument();
    expect(within(task).getByText('Planning')).toBeInTheDocument();
    expect(within(task).getByText('5 points')).toBeInTheDocument();
    expect(within(task).getByText('Added by you')).toBeInTheDocument();
  });

  it('defaults to a physical task worth 3 points', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Vacuum');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(within(task).getByText('Physical')).toBeInTheDocument();
    expect(within(task).getByText('3 points')).toBeInTheDocument();
  });

  it('keeps the form and explains when the task cannot be saved', async () => {
    const user = userEvent.setup();
    fakeTasksBackend.failRequests();
    renderAppAt('/tasks/new');

    await fillInTask(user, 'Dishes');

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save the task.");
    expect(screen.getByLabelText('Task')).toHaveValue('Dishes');
  });

  it.each([
    { case: 'an empty name', title: '   ', points: '3', message: 'Give the task a name.' },
    { case: 'too few points', title: 'Dishes', points: '0', message: POINTS_ERROR },
    { case: 'too many points', title: 'Dishes', points: '11', message: POINTS_ERROR },
    { case: 'fractional points', title: 'Dishes', points: '2.5', message: POINTS_ERROR },
  ])('refuses to create a task with $case', async ({ title, points, message }) => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await fillInTask(user, title, points);

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('heading', { level: 1, name: 'New task' })).toBeInTheDocument();
  });

  it('points out and focuses the field that needs fixing', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Dishes');
    await user.clear(screen.getByLabelText('Points'));
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const points = screen.getByLabelText('Points');
    expect(points).toHaveFocus();
    expect(points).toHaveAttribute('aria-invalid', 'true');
    expect(points).toHaveAccessibleDescription(POINTS_ERROR);
    expect(screen.getByLabelText('Task')).toHaveAttribute('aria-invalid', 'false');
  });

  it('limits task names to 80 characters', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'a'.repeat(90));

    expect(screen.getByLabelText('Task')).toHaveValue('a'.repeat(80));
  });

  it('can be cancelled without creating a task', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Laundry');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(await screen.findByText('No tasks yet. Create the first one!')).toBeInTheDocument();
  });
});
