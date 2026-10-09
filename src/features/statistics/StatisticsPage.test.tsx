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
