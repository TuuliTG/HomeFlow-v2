import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { toDateTimeLocal } from '@/features/tasks/reminder';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

const HOUR_MS = 60 * 60 * 1000;

function inHours(hours: number): Date {
  const date = new Date(Date.now() + hours * HOUR_MS);
  date.setSeconds(0, 0);
  return date;
}

function addPrivateTask(userId: string, title: string) {
  fakeTasksBackend.addTaskAs(userId, { title, type: 'meta', points: null, isPrivate: true });
}

describe('task reminders', () => {
  it('can be set for a private task', async () => {
    const anna = logInAsFamilyMember();
    addPrivateTask(anna.id, 'Buy a present');
    const user = userEvent.setup();
    renderAppAt('/me');

    const task = await screen.findByRole('listitem', { name: 'Buy a present' });
    await user.click(within(task).getByRole('button', { name: 'Remind me: Buy a present' }));
    const time = within(task).getByLabelText('Remind me at');
    expect(time).toHaveValue(toDateTimeLocal(inHours(1)).slice(0, 14) + '00');
    await user.clear(time);
    await user.type(time, toDateTimeLocal(inHours(3)));
    await user.click(within(task).getByRole('button', { name: 'Save reminder' }));

    expect(await within(task).findByText(/^Reminder /)).toBeInTheDocument();
    expect(fakeTasksBackend.reminderOf(anna.id, 'task:0')).toBe(inHours(3).toISOString());
  });

  it('can be set for a task you picked up, and goes when you put it back', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    fakeTasksBackend.pickUpTaskAs(anna.id, 'task:0');
    fakeTasksBackend.setReminderAs(anna.id, 'task:0', inHours(2).toISOString());
    const user = userEvent.setup();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(await within(task).findByText(/^Reminder /)).toBeInTheDocument();
    await user.click(within(task).getByRole('button', { name: 'Put back: Vacuum' }));

    expect(
      await within(task).findByRole('button', { name: 'Pick up: Vacuum' }),
    ).toBeInTheDocument();
    expect(within(task).queryByText(/^Reminder /)).not.toBeInTheDocument();
    expect(within(task).queryByRole('button', { name: /Remind me/ })).not.toBeInTheDocument();
    expect(fakeTasksBackend.reminderOf(anna.id, 'task:0')).toBeNull();
  });

  it("can't be set for a task that isn't yours to do", async () => {
    const anna = logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Dishes', type: 'physical', points: 1 });
    fakeTasksBackend.pickUpTaskAs(ben.id, 'task:1');
    renderAppAt('/');

    await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(screen.queryByRole('button', { name: /Remind me/ })).not.toBeInTheDocument();
  });

  it('can be removed', async () => {
    const anna = logInAsFamilyMember();
    addPrivateTask(anna.id, 'Buy a present');
    fakeTasksBackend.setReminderAs(anna.id, 'task:0', inHours(2).toISOString());
    const user = userEvent.setup();
    renderAppAt('/me');

    const task = await screen.findByRole('listitem', { name: 'Buy a present' });
    await user.click(
      await within(task).findByRole('button', { name: 'Remove reminder: Buy a present' }),
    );

    expect(
      await within(task).findByRole('button', { name: 'Remind me: Buy a present' }),
    ).toBeInTheDocument();
    expect(fakeTasksBackend.reminderOf(anna.id, 'task:0')).toBeNull();
  });

  it('can be moved to another time', async () => {
    const anna = logInAsFamilyMember();
    addPrivateTask(anna.id, 'Buy a present');
    fakeTasksBackend.setReminderAs(anna.id, 'task:0', inHours(2).toISOString());
    const user = userEvent.setup();
    renderAppAt('/me');

    const task = await screen.findByRole('listitem', { name: 'Buy a present' });
    await user.click(
      await within(task).findByRole('button', { name: 'Change reminder: Buy a present' }),
    );
    const time = within(task).getByLabelText('Remind me at');
    expect(time).toHaveValue(toDateTimeLocal(inHours(2)));
    await user.clear(time);
    await user.type(time, toDateTimeLocal(inHours(5)));
    await user.click(within(task).getByRole('button', { name: 'Save reminder' }));

    await within(task).findByRole('button', { name: 'Change reminder: Buy a present' });
    expect(fakeTasksBackend.reminderOf(anna.id, 'task:0')).toBe(inHours(5).toISOString());
  });

  it('must be in the future', async () => {
    const anna = logInAsFamilyMember();
    addPrivateTask(anna.id, 'Buy a present');
    const user = userEvent.setup();
    renderAppAt('/me');

    const task = await screen.findByRole('listitem', { name: 'Buy a present' });
    await user.click(within(task).getByRole('button', { name: 'Remind me: Buy a present' }));
    const time = within(task).getByLabelText('Remind me at');
    await user.clear(time);
    await user.type(time, toDateTimeLocal(inHours(-1)));
    await user.click(within(task).getByRole('button', { name: 'Save reminder' }));

    expect(await within(task).findByRole('alert')).toHaveTextContent('Pick a time in the future.');
    expect(fakeTasksBackend.reminderOf(anna.id, 'task:0')).toBeNull();
  });

  it('can be cancelled without setting one', async () => {
    const anna = logInAsFamilyMember();
    addPrivateTask(anna.id, 'Buy a present');
    const user = userEvent.setup();
    renderAppAt('/me');

    const task = await screen.findByRole('listitem', { name: 'Buy a present' });
    await user.click(within(task).getByRole('button', { name: 'Remind me: Buy a present' }));
    await user.click(within(task).getByRole('button', { name: 'Cancel' }));

    expect(within(task).queryByLabelText('Remind me at')).not.toBeInTheDocument();
    expect(fakeTasksBackend.reminderOf(anna.id, 'task:0')).toBeNull();
  });

  it('says so when saving fails', async () => {
    const anna = logInAsFamilyMember();
    addPrivateTask(anna.id, 'Buy a present');
    const user = userEvent.setup();
    renderAppAt('/me');

    const task = await screen.findByRole('listitem', { name: 'Buy a present' });
    await user.click(within(task).getByRole('button', { name: 'Remind me: Buy a present' }));
    fakeTasksBackend.failRequests();
    await user.click(within(task).getByRole('button', { name: 'Save reminder' }));

    expect(await within(task).findByRole('alert')).toHaveTextContent(
      "We couldn't save the reminder. Try again.",
    );
  });
});
