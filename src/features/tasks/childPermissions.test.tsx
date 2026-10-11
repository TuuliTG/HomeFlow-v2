import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

/** Anna (adult) adds "Feed the cat" for children; Ben is her child, optionally allowed to add tasks. */
function setUpFamily({ benCanAddTasks = false } = {}) {
  const anna = fakeAuthBackend.addAccount('anna@example.com', 'Anna');
  fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
  const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  fakeHouseholdBackend.setChild(ben.id, true);
  fakeHouseholdBackend.setCanAddTasks(ben.id, benCanAddTasks);
  fakeTasksBackend.addTaskAs(anna.id, {
    title: 'Feed the cat',
    type: 'physical',
    points: 2,
    forChildren: true,
  });
  return { anna, ben };
}

function logInAsBen() {
  return fakeAuthBackend.logInAs('ben@example.com', 'Ben');
}

describe('what children may do with tasks', () => {
  it('a child adds no tasks until an adult lets them', async () => {
    setUpFamily();
    logInAsBen();
    renderAppAt('/');

    await screen.findByRole('listitem', { name: 'Feed the cat' });
    expect(screen.queryByRole('link', { name: 'New task' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit: Feed the cat' })).not.toBeInTheDocument();
  });

  it('a child who opens New task anyway is told to ask an adult', async () => {
    setUpFamily();
    logInAsBen();
    renderAppAt('/tasks/new');

    expect(
      await screen.findByText('Ask an adult in your family to let you add tasks.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Task')).not.toBeInTheDocument();
  });

  it('an allowed child adds a task without choosing points, which then waits for them', async () => {
    setUpFamily({ benCanAddTasks: true });
    logInAsBen();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Tidy my room');
    expect(screen.queryByLabelText('Points')).not.toBeInTheDocument();
    expect(
      screen.getByText('An adult in your family chooses the points once you have done it.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Tidy my room' });
    expect(within(task).getByText('Waiting for points')).toBeInTheDocument();
    expect(tasks.at(-1)).toMatchObject({ points: null, forChildren: true, isPrivate: false });
  });

  it('an allowed child can keep a task private, like an adult', async () => {
    setUpFamily({ benCanAddTasks: true });
    logInAsBen();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Read my book');
    await user.click(screen.getByRole('checkbox', { name: 'Keep it private' }));
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await screen.findByRole('heading', { level: 1, name: 'My tasks' });
    expect(tasks.at(-1)).toMatchObject({ isPrivate: true, points: null });
  });
});

describe('awarding points', () => {
  it("an adult awards the points of a child's done task, which then count for the child", async () => {
    const { ben } = setUpFamily({ benCanAddTasks: true });
    fakeTasksBackend.addTaskAs(ben.id, {
      title: 'Tidy my room',
      type: 'physical',
      points: null,
      forChildren: true,
    });
    fakeTasksBackend.completeTaskAs(ben.id, 'task:1', '2026-10-10');
    fakeAuthBackend.logInAs('anna@example.com', 'Anna');
    const user = userEvent.setup();
    renderAppAt('/');

    const waiting = await screen.findByRole('region', { name: 'Waiting for points' });
    expect(within(waiting).getByText('Tidy my room')).toBeInTheDocument();
    expect(within(waiting).getByText('Done by Ben')).toBeInTheDocument();
    await user.selectOptions(within(waiting).getByLabelText('Points for Tidy my room'), '4');
    await user.click(within(waiting).getByRole('button', { name: 'Award points: Tidy my room' }));

    await vi.waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Waiting for points' })).not.toBeInTheDocument();
    });
    expect(tasks.find((task) => task.title === 'Tidy my room')?.points).toBe(4);
  });

  it('children never see the list of points to award', async () => {
    const { ben } = setUpFamily({ benCanAddTasks: true });
    fakeTasksBackend.addTaskAs(ben.id, {
      title: 'Tidy my room',
      type: 'physical',
      points: null,
      forChildren: true,
    });
    logInAsBen();
    renderAppAt('/');

    await screen.findByRole('listitem', { name: 'Tidy my room' });
    expect(screen.queryByRole('region', { name: 'Waiting for points' })).not.toBeInTheDocument();
  });

  it('adults are asked only when a task waits for points', async () => {
    logInAsFamilyMember();
    renderAppAt('/');

    await screen.findByRole('heading', { level: 1, name: 'Shared tasks' });
    expect(screen.queryByRole('region', { name: 'Waiting for points' })).not.toBeInTheDocument();
  });
});
