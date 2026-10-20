import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeGoalsBackend } from '@/test/fakeGoalsApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

/** Anna, an adult, adds Ben's goal and tasks for children; Ben, her child, logs in. */
function logInAsChild({ withGoal = true } = {}) {
  const anna = fakeAuthBackend.addProfile('anna@example.com', 'Anna');
  fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
  const ben = fakeAuthBackend.logInAs('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  fakeHouseholdBackend.setChild(ben.id, true);
  if (withGoal) {
    fakeGoalsBackend.addGoalAs(ben.id, { title: 'Cinema trip', targetPoints: 10, isShared: false });
  }
  const bed = fakeTasksBackend.addTaskAs(anna.id, {
    title: 'Make your bed',
    type: 'physical',
    points: 2,
    forChildren: true,
    icon: 'bed',
  });
  fakeTasksBackend.pickUpTaskAs(ben.id, bed);
  fakeTasksBackend.addTaskAs(anna.id, {
    title: 'Feed the cat',
    type: 'physical',
    points: 3,
    forChildren: true,
    icon: 'pet',
  });
  return ben;
}

describe('the Me page for children', () => {
  it('fills a star jar towards their goal as they do their tasks', async () => {
    logInAsChild();
    const user = userEvent.setup();
    renderAppAt('/me');

    const jar = await screen.findByRole('progressbar', { name: 'Progress towards Cinema trip' });
    expect(jar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('10 more points to go')).toBeInTheDocument();

    const myTasks = screen.getByRole('list', { name: 'My tasks' });
    const bed = within(myTasks).getByRole('listitem', { name: 'Make your bed' });
    expect(within(bed).getByRole('img', { name: '2 points' })).toBeInTheDocument();

    await user.click(within(bed).getByRole('button', { name: 'Mark done: Make your bed' }));

    expect(await screen.findByText('8 more points to go')).toBeInTheDocument();
    expect(jar).toHaveAttribute('aria-valuenow', '2');
    const completed = screen.getByRole('list', { name: 'Completed tasks' });
    expect(within(completed).getByText('Make your bed')).toBeInTheDocument();
  });

  it('lets them pick a task to do', async () => {
    logInAsChild();
    const user = userEvent.setup();
    renderAppAt('/me');

    const toPick = await screen.findByRole('list', { name: 'Pick a task' });
    await user.click(within(toPick).getByRole('button', { name: 'Pick up: Feed the cat' }));

    const myTasks = screen.getByRole('list', { name: 'My tasks' });
    expect(
      await within(myTasks).findByRole('listitem', { name: 'Feed the cat' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No tasks to pick right now.')).toBeInTheDocument();
  });

  it('asks them to have a grown-up set a goal when they have none', async () => {
    logInAsChild({ withGoal: false });
    renderAppAt('/me');

    expect(await screen.findByRole('heading', { name: 'No goal yet' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('stays the same for adults', async () => {
    logInAsFamilyMember();
    renderAppAt('/me');

    expect(await screen.findByRole('heading', { name: 'Points earned' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Pick a task' })).not.toBeInTheDocument();
  });
});
