import { screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

const POINTS_ERROR = 'Points must be a whole number from 1 to 10.';

/** Wednesday 8 October 2026, midday where the test runs. */
function setToday() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 12));
}

afterEach(() => {
  vi.useRealTimers();
});

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
    fakeTasksBackend.addTaskAs(ben.id, { title: 'Book dentist', type: 'meta', points: 5 });
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

  it('lists the soonest due tasks first, and tasks without a due date last', async () => {
    const anna = logInAsFamilyMember();
    const add = (title: string, dueOn: string | null) => {
      fakeTasksBackend.addTaskAs(anna.id, { title, type: 'physical', points: 1, dueOn });
    };
    add('Dust', null);
    add('Change bed linen', '2026-10-22');
    add('Vacuum', '2026-10-06');
    add('Water plants', null);
    add('Take out recycling', '2026-10-09');
    renderAppAt('/');

    await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(screen.getAllByRole('heading', { level: 2 }).map((title) => title.textContent)).toEqual([
      'Vacuum',
      'Take out recycling',
      'Change bed linen',
      'Water plants',
      'Dust',
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
    await user.click(screen.getByRole('radio', { name: 'Meta work' }));
    await user.clear(screen.getByLabelText('Points'));
    await user.type(screen.getByLabelText('Points'), '5');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Book dentist' });
    expect(screen.getByRole('heading', { level: 1, name: 'Shared tasks' })).toBeInTheDocument();
    expect(within(task).getByText('Meta work')).toBeInTheDocument();
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

  it('can repeat and have a due date', async () => {
    setToday();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Change bed linen');
    await user.selectOptions(screen.getByLabelText('Repeats'), 'Every 2 weeks');
    expect(screen.getByLabelText('Repeats')).toHaveAccessibleDescription(
      "Each time it's done, it comes back 14 days later.",
    );
    await user.type(screen.getByLabelText('Due date'), '2026-10-10');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Change bed linen' });
    expect(within(task).getByText('Every 2 weeks')).toBeInTheDocument();
    expect(within(task).getByText('Due Sat 10 Oct')).toBeInTheDocument();
  });

  it('can have a description that shows on the board', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Take out the trash');
    await user.type(
      screen.getByLabelText('Description (optional)'),
      '  The bins are behind the garage.  ',
    );
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Take out the trash' });
    expect(within(task).getByText('The bins are behind the garage.')).toBeInTheDocument();
  });

  it("doesn't repeat or have a due date unless asked", async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await fillInTask(user, 'Fix the shelf');

    const task = await screen.findByRole('listitem', { name: 'Fix the shelf' });
    expect(within(task).queryByText(/^Every/)).not.toBeInTheDocument();
    expect(within(task).queryByText(/due/i)).not.toBeInTheDocument();
    expect(within(task).queryByRole('paragraph')).not.toBeInTheDocument();
  });

  it('can be cancelled without creating a task', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Laundry');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(await screen.findByText('No tasks yet. Create the first one!')).toBeInTheDocument();
  });
});

describe('marking a task done', () => {
  it('takes a one-off task off the board', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Fix the shelf', type: 'physical', points: 3 });
    const user = userEvent.setup();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Fix the shelf' });
    await user.click(within(task).getByRole('button', { name: 'Mark done: Fix the shelf' }));

    expect(await screen.findByText('No tasks yet. Create the first one!')).toBeInTheDocument();
  });

  it('brings a repeating task back, due that many days after it was done', async () => {
    setToday();
    logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    // Overdue: the next one is due two weeks from today, not from its old due date.
    fakeTasksBackend.addTaskAs(ben.id, {
      title: 'Change bed linen',
      type: 'physical',
      points: 4,
      repeatEveryDays: 14,
      dueOn: '2026-10-01',
    });
    const user = userEvent.setup();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Change bed linen' });
    expect(within(task).getByText('Was due Thu 1 Oct')).toBeInTheDocument();
    await user.click(within(task).getByRole('button', { name: /^Mark done/ }));

    expect(await screen.findByText('Due Thu 22 Oct')).toBeInTheDocument();
    const next = screen.getByRole('listitem', { name: 'Change bed linen' });
    expect(within(next).getByText('Every 2 weeks')).toBeInTheDocument();
    expect(within(next).getByText('Added by Ben')).toBeInTheDocument();
    expect(screen.queryByText('Was due Thu 1 Oct')).not.toBeInTheDocument();
  });

  it('says when a due date is today or tomorrow', async () => {
    setToday();
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Vacuum',
      type: 'physical',
      points: 3,
      dueOn: '2026-10-08',
    });
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Dust',
      type: 'physical',
      points: 2,
      dueOn: '2026-10-09',
    });
    renderAppAt('/');

    const vacuum = await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(within(vacuum).getByText('Due today')).toBeInTheDocument();
    const dust = screen.getByRole('listitem', { name: 'Dust' });
    expect(within(dust).getByText('Due tomorrow')).toBeInTheDocument();
  });

  it('keeps the task and explains when it cannot be marked done', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    const user = userEvent.setup();
    renderAppAt('/');
    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    fakeTasksBackend.failRequests();

    await user.click(within(task).getByRole('button', { name: /^Mark done/ }));

    expect(await within(task).findByRole('alert')).toHaveTextContent(
      "We couldn't mark the task done.",
    );
    expect(screen.getByRole('listitem', { name: 'Vacuum' })).toBeInTheDocument();
  });
});
