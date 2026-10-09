import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

const FORTY_DAYS_MS = 40 * 24 * 60 * 60 * 1000;

function addTask(userId: string, title: string, isPrivate = false) {
  fakeTasksBackend.addTaskAs(userId, {
    title,
    type: 'physical',
    points: isPrivate ? null : 3,
    isPrivate,
  });
}

function addBen() {
  const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  return ben;
}

async function leaderboardRows() {
  const leaderboard = await screen.findByRole('region', { name: 'Leaderboard' });
  return within(leaderboard)
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}

describe('statistics page', () => {
  it("ranks members by what they did and added this week, and scores how fairly it's shared", async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    addTask(anna.id, 'Vacuum');
    addTask(anna.id, 'Book dentist');
    addTask(anna.id, 'Water plants');
    fakeTasksBackend.completeTaskAs(ben.id, 'task:0', '2026-10-09');
    renderAppAt('/statistics');

    expect(await leaderboardRows()).toEqual(['You0 done · 3 added', 'Ben1 done · 0 added']);
    const fairness = screen.getByRole('region', { name: 'Fairness score' });
    expect(fairness).toHaveTextContent('50/ 100');
    expect(fairness).toHaveTextContent('Slightly uneven');
  });

  it('counts earlier work under a longer period, kept in the address', async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    addTask(ben.id, 'Vacuum');
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-09');
    fakeTasksBackend.ageTasks(FORTY_DAYS_MS);
    addTask(anna.id, 'Book dentist');
    const user = userEvent.setup();
    const { router } = renderAppAt('/statistics');

    expect(await leaderboardRows()).toEqual(['You0 done · 1 added', 'Ben0 done · 0 added']);
    expect(screen.getByRole('radio', { name: 'This week' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'All time' }));

    await vi.waitFor(async () => {
      expect(await leaderboardRows()).toEqual(['You1 done · 1 added', 'Ben0 done · 1 added']);
    });
    expect(screen.getByRole('radio', { name: 'All time' })).toBeChecked();
    expect(router.state.location.search).toBe('?period=all');
    expect(screen.getByRole('region', { name: 'Fairness score' })).toHaveTextContent('67/ 100');
  });

  it('leaves out private tasks', async () => {
    const anna = logInAsFamilyMember();
    addBen();
    addTask(anna.id, 'Buy a present', true);
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-09');
    renderAppAt('/statistics?period=month');

    expect(await leaderboardRows()).toEqual(['You0 done · 0 added', 'Ben0 done · 0 added']);
    expect(screen.getByRole('radio', { name: 'This month' })).toBeChecked();
    expect(screen.getByRole('region', { name: 'Fairness score' })).toHaveTextContent(
      'Nothing done or added yet in this period.',
    );
  });

  it('suggests inviting the family when there is no one to compare with', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum');
    renderAppAt('/statistics');

    expect(await leaderboardRows()).toEqual(['You0 done · 1 added']);
    expect(screen.getByRole('region', { name: 'Fairness score' })).toHaveTextContent(
      'Invite your family to see how the work is shared.',
    );
  });

  it('says so when the statistics cannot be loaded', async () => {
    logInAsFamilyMember();
    fakeTasksBackend.failRequests();
    renderAppAt('/statistics');

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the statistics.");
  });
});
