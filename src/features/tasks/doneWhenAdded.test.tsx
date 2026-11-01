import { screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

afterEach(() => {
  vi.useRealTimers();
});

async function addDoneTask(user: UserEvent, title: string) {
  await user.type(await screen.findByLabelText('Task'), title);
  await user.click(screen.getByRole('checkbox', { name: 'Already done' }));
  await user.click(screen.getByRole('button', { name: 'Create task' }));
}

describe('adding a task that is already done', () => {
  it('marks it done for the user, who earns its points, and shows it among their completed tasks', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await addDoneTask(user, 'Fix the shelf');

    expect(await screen.findByRole('heading', { level: 1, name: 'My tasks' })).toBeInTheDocument();
    const completed = await screen.findByRole('list', { name: 'Completed tasks' });
    expect(await within(completed).findByText('Fix the shelf')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'To do' })).not.toHaveTextContent('Fix the shelf');
    expect(await screen.findByText('+3 points')).toBeInTheDocument();
  });

  it('brings a repeating task back, due that many days from today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 8, 12));
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.selectOptions(await screen.findByLabelText('Repeats'), 'Every week');
    await addDoneTask(user, 'Water the plants');

    await screen.findByRole('heading', { level: 1, name: 'My tasks' });
    await user.click(screen.getByRole('link', { name: 'Shared tasks' }));
    const next = await screen.findByRole('listitem', { name: 'Water the plants' });
    expect(within(next).getByText('Due Thu 15 Oct')).toBeInTheDocument();
  });

  it("doesn't ask for a due date, as it is done already", async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Due date'), '2026-12-24');
    await user.click(screen.getByRole('checkbox', { name: 'Already done' }));

    expect(screen.queryByLabelText('Due date')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Already done' }));
    expect(screen.getByLabelText('Due date')).toHaveValue('');
  });

  it("warns that a child's chore can't be added as done, and saves it once it is any child's", async () => {
    const anna = logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(ben.id, true);
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Make your bed');
    await user.click(screen.getByRole('checkbox', { name: 'Children can do it' }));
    const whose = await screen.findByLabelText('Whose chore is it?');
    await user.selectOptions(whose, 'Ben');
    await user.click(screen.getByRole('checkbox', { name: 'Already done' }));
    const warning =
      'You can only mark your own tasks done when adding them. Choose “Any child”, or leave “Already done” unchecked for Ben to mark it done.';
    expect(whose).toHaveAccessibleDescription(warning);
    expect(whose).toBeInvalid();

    await user.click(screen.getByRole('button', { name: 'Create task' }));
    expect(whose).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1, name: 'New task' })).toBeInTheDocument();
    expect(tasks).toHaveLength(0);

    await user.selectOptions(whose, 'Any child');
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    await screen.findByRole('heading', { level: 1, name: 'My tasks' });
    expect(tasks.at(-1)).toMatchObject({
      assignedTo: null,
      forChildren: true,
      completed: { by: anna.id },
    });
  });

  it('works for private tasks too', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('checkbox', { name: 'Keep it private' }));
    await addDoneTask(user, 'Book the dentist');

    const completed = await screen.findByRole('list', { name: 'Completed tasks' });
    expect(await within(completed).findByText('Book the dentist')).toBeInTheDocument();
  });

  it('keeps the task to do if marking it done fails, so it can be marked done later', async () => {
    logInAsFamilyMember();
    vi.spyOn(fakeTasksBackend, 'completeTaskAs').mockImplementation(() => {
      throw new Error('offline');
    });
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await addDoneTask(user, 'Fix the shelf');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Shared tasks' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The task was added, but we couldn't mark it done. Mark it done here."),
    ).toBeInTheDocument();
    const task = await screen.findByRole('listitem', { name: 'Fix the shelf' });
    expect(
      within(task).getByRole('button', { name: 'Mark done: Fix the shelf' }),
    ).toBeInTheDocument();
  });

  it("isn't offered when editing a task or planning a new one in the timetable", async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    const { unmount } = renderAppAt('/tasks/task:0/edit');
    expect(await screen.findByLabelText('Task')).toHaveValue('Vacuum');
    expect(screen.queryByRole('checkbox', { name: 'Already done' })).not.toBeInTheDocument();
    unmount();

    const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    renderAppAt(`/tasks/new?at=${encodeURIComponent(startsAt)}&view=day`);
    expect(await screen.findByLabelText('Task')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Already done' })).not.toBeInTheDocument();
  });
});
