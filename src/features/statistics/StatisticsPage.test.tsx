import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

const FORTY_DAYS_MS = 40 * 24 * 60 * 60 * 1000;

function addTask(userId: string, title: string, points: number | null = 3) {
  fakeTasksBackend.addTaskAs(userId, { title, type: 'physical', points, isPrivate: !points });
}

function addMetaTask(userId: string, title: string, points: number) {
  fakeTasksBackend.addTaskAs(userId, { title, type: 'meta', points });
}

function addBen() {
  const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  return ben;
}

function metric(name: 'Points earned' | 'Tasks created') {
  return screen.getByRole('region', { name });
}

/** Each member's row in a metric, most first. */
function rows(name: 'Points earned' | 'Tasks created') {
  return within(metric(name))
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}

/** The folded-away panel of who to compare and which work counts. */
function filters() {
  return screen.getByText('Filters', { selector: 'summary' });
}

describe('statistics page', () => {
  it('ranks points earned and tasks created separately, each with its own fairness score', async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    addTask(anna.id, 'Vacuum', 5);
    addTask(anna.id, 'Book dentist', 2);
    addTask(anna.id, 'Water plants', 1);
    fakeTasksBackend.completeTaskAs(ben.id, 'task:0', '2026-10-09');
    fakeTasksBackend.completeTaskAs(anna.id, 'task:1', '2026-10-09');
    renderAppAt('/statistics');

    await screen.findByRole('region', { name: 'Points earned' });
    expect(rows('Points earned')).toEqual([
      'Ben5 points · 1 task done',
      'You2 points · 1 task done',
    ]);
    expect(metric('Points earned')).toHaveTextContent('Fairness57/ 100Slightly uneven');
    expect(rows('Tasks created')).toEqual(['You3 tasks', 'Ben0 tasks']);
    expect(metric('Tasks created')).toHaveTextContent('Fairness0/ 100Uneven');
  });

  it('shows the points of physical and meta work apart, kept in the address', async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    addTask(anna.id, 'Vacuum', 5);
    addMetaTask(anna.id, 'Book dentist', 2);
    addMetaTask(anna.id, 'Plan the party', 4);
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-09');
    fakeTasksBackend.completeTaskAs(anna.id, 'task:1', '2026-10-09');
    fakeTasksBackend.completeTaskAs(ben.id, 'task:2', '2026-10-09');
    const user = userEvent.setup();
    const { router } = renderAppAt('/statistics?period=month');

    await screen.findByRole('region', { name: 'Points earned' });
    await user.click(filters());
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    expect(rows('Points earned')).toEqual([
      'You7 points · 2 tasks done',
      'Ben4 points · 1 task done',
    ]);
    expect(
      within(metric('Points earned')).getByRole('img', {
        name: '5 physical points, 2 meta work points',
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Physical' }));
    expect(rows('Points earned')).toEqual([
      'You5 points · 1 task done',
      'Ben0 points · 0 tasks done',
    ]);
    expect(metric('Points earned')).toHaveTextContent('Fairness0/ 100Uneven');

    await user.click(screen.getByRole('radio', { name: 'Meta work' }));
    expect(rows('Points earned')).toEqual([
      'Ben4 points · 1 task done',
      'You2 points · 1 task done',
    ]);
    expect(router.state.location.search).toBe('?period=month&work=meta');
    expect(rows('Tasks created')).toEqual(['You3 tasks', 'Ben0 tasks']);
  });

  it('counts earlier work under a longer period, kept in the address', async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    addTask(ben.id, 'Vacuum', 4);
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-09');
    fakeTasksBackend.ageTasks(FORTY_DAYS_MS);
    addTask(anna.id, 'Book dentist');
    const user = userEvent.setup();
    const { router } = renderAppAt('/statistics');

    await screen.findByRole('region', { name: 'Points earned' });
    expect(rows('Points earned')).toEqual([
      'You0 points · 0 tasks done',
      'Ben0 points · 0 tasks done',
    ]);
    expect(metric('Points earned')).toHaveTextContent('No points earned yet in this period.');
    expect(rows('Tasks created')).toEqual(['You1 task', 'Ben0 tasks']);
    expect(screen.getByRole('radio', { name: 'This week' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'All time' }));

    await vi.waitFor(() => {
      expect(rows('Points earned')).toEqual([
        'You4 points · 1 task done',
        'Ben0 points · 0 tasks done',
      ]);
    });
    expect(rows('Tasks created')).toEqual(['You1 task', 'Ben1 task']);
    expect(metric('Tasks created')).toHaveTextContent('Fairness100/ 100Balanced');
    expect(screen.getByRole('radio', { name: 'All time' })).toBeChecked();
    expect(router.state.location.search).toBe('?period=all');
  });

  it('compares only the adults, the children or members chosen one by one, kept in the address', async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    const cleo = fakeAuthBackend.addProfile('cleo@example.com', 'Cleo');
    fakeHouseholdBackend.addMember(cleo.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(cleo.id, true);
    addTask(anna.id, 'Vacuum', 5);
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Tidy room',
      type: 'physical',
      points: 2,
      forChildren: true,
    });
    fakeTasksBackend.completeTaskAs(ben.id, 'task:0', '2026-10-09');
    fakeTasksBackend.completeTaskAs(cleo.id, 'task:1', '2026-10-09');
    const user = userEvent.setup();
    const { router } = renderAppAt('/statistics');

    await screen.findByRole('region', { name: 'Points earned' });
    await user.click(filters());
    expect(screen.getByRole('radio', { name: 'Everyone' })).toBeChecked();
    expect(rows('Points earned')).toEqual([
      'Ben5 points · 1 task done',
      'Cleo2 points · 1 task done',
      'You0 points · 0 tasks done',
    ]);

    await user.click(screen.getByRole('radio', { name: 'Adults' }));
    expect(rows('Points earned')).toEqual([
      'Ben5 points · 1 task done',
      'You0 points · 0 tasks done',
    ]);
    expect(metric('Points earned')).toHaveTextContent('Fairness0/ 100Uneven');
    expect(rows('Tasks created')).toEqual(['You2 tasks', 'Ben0 tasks']);
    expect(screen.getByRole('checkbox', { name: 'Cleo' })).not.toBeChecked();
    expect(router.state.location.search).toBe('?compare=adults');

    await user.click(screen.getByRole('checkbox', { name: 'Cleo' }));
    await user.click(screen.getByRole('checkbox', { name: 'You' }));
    expect(rows('Points earned')).toEqual([
      'Ben5 points · 1 task done',
      'Cleo2 points · 1 task done',
    ]);
    expect(screen.getByRole('radio', { name: 'Everyone' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Adults' })).not.toBeChecked();
    expect(router.state.location.search).toBe(
      `?compare=${encodeURIComponent(`${ben.id},${cleo.id}`)}`,
    );

    await user.click(screen.getByRole('checkbox', { name: 'Ben' }));
    expect(rows('Points earned')).toEqual(['Cleo2 points · 1 task done']);
    expect(screen.getByRole('radio', { name: 'Children' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Cleo' })).toBeDisabled();
  });

  it('keeps the filters folded away, naming the active ones', async () => {
    logInAsFamilyMember();
    const ben = addBen();
    const cleo = fakeAuthBackend.addProfile('cleo@example.com', 'Cleo');
    fakeHouseholdBackend.addMember(cleo.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(cleo.id, true);
    const user = userEvent.setup();
    const { router } = renderAppAt('/statistics');

    await screen.findByRole('region', { name: 'Points earned' });
    const panel = filters().closest('details');
    expect(panel).not.toHaveAttribute('open');
    expect(filters()).toHaveTextContent(/^Filters$/);

    await router.navigate('/statistics?compare=adults&work=physical');
    await vi.waitFor(() => {
      expect(filters()).toHaveTextContent('FiltersAdults · Physical');
    });

    await router.navigate(`/statistics?compare=${ben.id},${cleo.id}`);
    await vi.waitFor(() => {
      expect(filters()).toHaveTextContent('FiltersBen, Cleo');
    });

    await user.click(filters());
    expect(panel).toHaveAttribute('open');

    await user.click(screen.getByRole('radio', { name: 'All time' }));
    await vi.waitFor(() => {
      expect(filters().closest('details')).toHaveAttribute('open');
    });
  });

  it('compares whoever the address names, everyone when it names no one here', async () => {
    logInAsFamilyMember();
    const ben = addBen();
    const cleo = fakeAuthBackend.addProfile('cleo@example.com', 'Cleo');
    fakeHouseholdBackend.addMember(cleo.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(cleo.id, true);
    const { router } = renderAppAt(`/statistics?compare=${ben.id},someone-who-left`);

    await screen.findByRole('region', { name: 'Tasks created' });
    expect(rows('Tasks created')).toEqual(['Ben0 tasks']);

    await router.navigate('/statistics?compare=adults');
    await vi.waitFor(() => {
      expect(rows('Tasks created')).toEqual(['You0 tasks', 'Ben0 tasks']);
    });
    expect(screen.getByRole('radio', { name: 'Adults' })).toBeChecked();

    await router.navigate('/statistics?compare=someone-who-left');
    await vi.waitFor(() => {
      expect(rows('Tasks created')).toEqual(['You0 tasks', 'Ben0 tasks', 'Cleo0 tasks']);
    });
  });

  it('remembers the period, work type and who is compared after leaving the page', async () => {
    logInAsFamilyMember();
    addBen();
    const cleo = fakeAuthBackend.addProfile('cleo@example.com', 'Cleo');
    fakeHouseholdBackend.addMember(cleo.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(cleo.id, true);
    const user = userEvent.setup();
    const { router } = renderAppAt('/statistics');

    await screen.findByRole('region', { name: 'Points earned' });
    await user.click(screen.getByRole('radio', { name: 'This month' }));
    await user.click(filters());
    await user.click(screen.getByRole('radio', { name: 'Adults' }));
    await user.click(screen.getByRole('radio', { name: 'Meta work' }));

    await user.click(screen.getByRole('link', { name: 'Shared tasks' }));
    await user.click(await screen.findByRole('link', { name: 'Statistics' }));
    expect(router.state.location.search).toBe('');
    await screen.findByRole('region', { name: 'Tasks created' });
    expect(screen.getByRole('radio', { name: 'This month' })).toBeChecked();
    expect(filters()).toHaveTextContent('FiltersAdults · Meta work');
    expect(rows('Tasks created')).toEqual(['You0 tasks', 'Ben0 tasks']);
  });

  it('has no members to choose between in a family of two, whatever the address says', async () => {
    logInAsFamilyMember();
    const ben = addBen();
    fakeHouseholdBackend.setChild(ben.id, true);
    renderAppAt('/statistics?compare=children');

    await screen.findByRole('region', { name: 'Points earned' });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(rows('Tasks created')).toEqual(['You0 tasks', 'Ben0 tasks']);
  });

  it('leaves out private tasks', async () => {
    const anna = logInAsFamilyMember();
    addBen();
    addTask(anna.id, 'Buy a present', null);
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-09');
    renderAppAt('/statistics?period=month');

    await screen.findByRole('region', { name: 'Points earned' });
    expect(rows('Points earned')).toEqual([
      'You0 points · 0 tasks done',
      'Ben0 points · 0 tasks done',
    ]);
    expect(rows('Tasks created')).toEqual(['You0 tasks', 'Ben0 tasks']);
    expect(metric('Tasks created')).toHaveTextContent('No tasks created yet in this period.');
    expect(screen.getByRole('radio', { name: 'This month' })).toBeChecked();
  });

  it('suggests inviting the family when there is no one to compare with', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum');
    renderAppAt('/statistics');

    expect(
      await screen.findByText('Invite your family to see how the work is shared.'),
    ).toBeInTheDocument();
    expect(rows('Tasks created')).toEqual(['You1 task']);
    expect(metric('Tasks created')).not.toHaveTextContent('Fairness');
  });

  it('says so when the statistics cannot be loaded', async () => {
    logInAsFamilyMember();
    fakeTasksBackend.failRequests();
    renderAppAt('/statistics');

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the statistics.");
  });
});
