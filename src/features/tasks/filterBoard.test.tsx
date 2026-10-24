import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

function addTask(userId: string, title: string, dueOn: string | null = null) {
  fakeTasksBackend.addTaskAs(userId, { title, type: 'physical', points: 3, dueOn });
}

function expectShown(shown: string[], hidden: string[]) {
  for (const title of shown) {
    expect(screen.getByRole('listitem', { name: title })).toBeInTheDocument();
  }
  for (const title of hidden) {
    expect(screen.queryByRole('listitem', { name: title })).not.toBeInTheDocument();
  }
}

/** Wednesday 8 October 2026, midday where the test runs. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('filtering the board', () => {
  it('shows all tasks until a filter is chosen', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum', '2026-10-08');
    addTask(anna.id, 'Dust');
    renderAppAt('/');

    await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    expectShown(['Vacuum', 'Dust'], []);
  });

  it("shows today's tasks, this week's or those without a due date", async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum', '2026-10-06');
    addTask(anna.id, 'Cook', '2026-10-08');
    addTask(anna.id, 'Mop', '2026-10-14');
    addTask(anna.id, 'Change bed linen', '2026-10-22');
    addTask(anna.id, 'Dust');
    const user = userEvent.setup();
    renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Vacuum' });

    await user.click(screen.getByRole('radio', { name: 'Today' }));
    expectShown(['Vacuum', 'Cook'], ['Mop', 'Change bed linen', 'Dust']);

    await user.click(screen.getByRole('radio', { name: 'This week' }));
    expectShown(['Vacuum', 'Cook', 'Mop'], ['Change bed linen', 'Dust']);

    await user.click(screen.getByRole('radio', { name: 'No due date' }));
    expectShown(['Dust'], ['Vacuum', 'Cook', 'Mop', 'Change bed linen']);

    await user.click(screen.getByRole('radio', { name: 'All' }));
    expectShown(['Vacuum', 'Cook', 'Mop', 'Change bed linen', 'Dust'], []);
  });

  it('shows the tasks available to pick up, without private tasks', async () => {
    const anna = logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    addTask(anna.id, 'Vacuum');
    addTask(anna.id, 'Book dentist');
    addTask(anna.id, 'Water plants');
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Buy a present',
      type: 'meta',
      points: null,
      isPrivate: true,
    });
    fakeTasksBackend.pickUpTaskAs(anna.id, 'task:0');
    fakeTasksBackend.pickUpTaskAs(ben.id, 'task:1');
    const user = userEvent.setup();
    renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Vacuum' });

    await user.click(screen.getByRole('checkbox', { name: 'Available' }));

    expectShown(['Water plants'], ['Vacuum', 'Book dentist', 'Buy a present']);
  });

  it('combines a due date with the tasks available to pick up', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum', '2026-10-08');
    addTask(anna.id, 'Cook', '2026-10-08');
    addTask(anna.id, 'Mop', '2026-10-14');
    addTask(anna.id, 'Dust');
    fakeTasksBackend.pickUpTaskAs(anna.id, 'task:0');
    const user = userEvent.setup();
    const { router } = renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Vacuum' });

    await user.click(screen.getByRole('radio', { name: 'Today' }));
    await user.click(screen.getByRole('checkbox', { name: 'Available' }));
    expectShown(['Cook'], ['Vacuum', 'Mop', 'Dust']);
    expect(screen.getByRole('radio', { name: 'Today' })).toBeChecked();
    expect(router.state.location.search).toBe('?show=today&available=1');

    await user.click(screen.getByRole('radio', { name: 'This week' }));
    expectShown(['Cook', 'Mop'], ['Vacuum', 'Dust']);

    await user.click(screen.getByRole('checkbox', { name: 'Available' }));
    expectShown(['Vacuum', 'Cook', 'Mop'], ['Dust']);
    expect(router.state.location.search).toBe('?show=week');
  });

  it('says when everything within the filter has been picked up, read from the address', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum', '2026-10-08');
    addTask(anna.id, 'Dust');
    fakeTasksBackend.pickUpTaskAs(anna.id, 'task:0');
    renderAppAt('/?show=today&available=1');

    expect(await screen.findByText('Everything due today has been picked up.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Available' })).toBeChecked();
    expectShown([], ['Vacuum', 'Dust']);
  });

  it('keeps the choice in the address, and remembers it after leaving the page', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Dust');
    const user = userEvent.setup();
    const { router } = renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Dust' });

    await user.click(screen.getByRole('radio', { name: 'No due date' }));
    await user.click(screen.getByRole('switch', { name: 'Show completed' }));
    expect(router.state.location.search).toBe('?show=undated&completed=1');

    await user.click(screen.getByRole('link', { name: 'Statistics' }));
    await user.click(await screen.findByRole('link', { name: 'Shared tasks' }));
    expect(router.state.location.search).toBe('');
    expect(await screen.findByRole('radio', { name: 'No due date' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show completed' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'All' }));
    await user.click(screen.getByRole('link', { name: 'Shared tasks' }));
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
  });

  it('remembers the choice for each family member on a shared device', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Dust');
    localStorage.setItem(`homeflow:choice:board.show:${anna.id}`, 'undated');
    localStorage.setItem('homeflow:choice:board.show:someone-else', 'today');
    renderAppAt('/');

    await screen.findByRole('listitem', { name: 'Dust' });
    expect(screen.getByRole('radio', { name: 'No due date' })).toBeChecked();
  });

  it('still filters when this device cannot remember the choice', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Dust');
    const user = userEvent.setup();
    const { router } = renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Dust' });

    await user.click(screen.getByRole('radio', { name: 'No due date' }));
    expect(router.state.location.search).toBe('?show=undated');
    expectShown(['Dust'], []);
  });

  it('says when nothing matches, and is read from the address with "Show completed"', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Dust');
    renderAppAt('/?show=today&completed=1');

    expect(await screen.findByText('Nothing is due today.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Today' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show completed' })).toBeChecked();
    expectShown([], ['Dust']);
  });

  it('finds tasks by searching, together with the filter, and keeps the search in the address', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Wash the dishes', '2026-10-08');
    addTask(anna.id, 'Empty the dishwasher');
    addTask(anna.id, 'Vacuum', '2026-10-08');
    const user = userEvent.setup();
    const { router } = renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Vacuum' });

    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'dish');
    expectShown(['Wash the dishes', 'Empty the dishwasher'], ['Vacuum']);
    expect(router.state.location.search).toBe('?q=dish');
    expect(screen.getByText('2 tasks found')).toHaveAttribute('role', 'status');

    await user.click(screen.getByRole('radio', { name: 'Today' }));
    expectShown(['Wash the dishes'], ['Empty the dishwasher', 'Vacuum']);

    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'es window');
    expect(screen.getByText('No tasks match “dishes window”.')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Search tasks' }));
    expectShown(['Wash the dishes', 'Vacuum'], ['Empty the dishwasher']);
    expect(router.state.location.search).toBe('?show=today');
  });

  it('reads the search from the address', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Wash the dishes');
    addTask(anna.id, 'Vacuum');
    renderAppAt('/?q=vacuum');

    await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(screen.getByRole('searchbox', { name: 'Search tasks' })).toHaveValue('vacuum');
    expectShown(['Vacuum'], ['Wash the dishes']);
  });
});

describe('filtering the board by who has picked tasks up', () => {
  /** Anna (logged in), Ben and Mia, each with a task picked up, and one task nobody has. */
  function familyWithTasks() {
    const anna = logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    const mia = fakeAuthBackend.addProfile('mia@example.com', 'Mia');
    for (const member of [ben, mia]) fakeHouseholdBackend.addMember(member.id, 'The Virtanens');
    for (const [member, title] of [
      [anna, 'Cook'],
      [ben, 'Vacuum'],
      [mia, 'Mop'],
    ] as const) {
      const id = fakeTasksBackend.addTaskAs(anna.id, { title, type: 'physical', points: 3 });
      fakeTasksBackend.pickUpTaskAs(member.id, id);
    }
    addTask(anna.id, 'Dust');
    return { anna, ben, mia };
  }

  it("shows everyone's tasks until a family member is chosen, then only theirs", async () => {
    familyWithTasks();
    const user = userEvent.setup();
    const { router } = renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Dust' });

    const who = screen.getByRole('group', { name: 'Picked up by' });
    expect(within(who).getByRole('radio', { name: 'Everyone' })).toBeChecked();
    expectShown(['Cook', 'Vacuum', 'Mop', 'Dust'], []);

    await user.click(within(who).getByRole('radio', { name: 'Ben' }));
    expectShown(['Vacuum'], ['Cook', 'Mop', 'Dust']);
    expect(router.state.location.search).toMatch(/^\?who=/);

    await user.click(within(who).getByRole('radio', { name: 'You' }));
    expectShown(['Cook'], ['Vacuum', 'Mop', 'Dust']);

    await user.click(within(who).getByRole('radio', { name: 'Everyone' }));
    expectShown(['Cook', 'Vacuum', 'Mop', 'Dust'], []);
    expect(router.state.location.search).toBe('');
  });

  it('works together with the other filters and says when someone has nothing', async () => {
    const { mia } = familyWithTasks();
    const user = userEvent.setup();
    renderAppAt(`/?who=${mia.id}`);

    await screen.findByRole('listitem', { name: 'Mop' });
    expectShown(['Mop'], ['Cook', 'Vacuum', 'Dust']);
    await user.click(screen.getByRole('checkbox', { name: 'Available' }));
    expect(screen.getByText('Mia has no tasks picked up here.')).toBeInTheDocument();
  });

  it("shows everyone's tasks for someone who isn't in the household", async () => {
    familyWithTasks();
    renderAppAt('/?who=someone-else');

    await screen.findByRole('listitem', { name: 'Dust' });
    expect(screen.getByRole('radio', { name: 'Everyone' })).toBeChecked();
    expectShown(['Cook', 'Vacuum', 'Mop', 'Dust'], []);
  });

  it("isn't offered to someone alone in their household", async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Dust');
    renderAppAt('/');

    await screen.findByRole('listitem', { name: 'Dust' });
    expect(screen.queryByRole('group', { name: 'Picked up by' })).not.toBeInTheDocument();
  });
});
