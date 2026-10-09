import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TASK_ACTIVITY_DURATION_MS } from '@/features/tasks/useTaskActivity';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksApi';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

function addBen(householdName = 'The Virtanens') {
  const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, householdName);
  return ben;
}

function activityMessage() {
  return screen.getAllByRole('status').find((region) => region.textContent.includes('added'));
}

describe('live task updates', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a task another member adds, and says who added it', async () => {
    logInAsFamilyMember();
    const ben = addBen();
    renderAppAt('/');
    await screen.findByText('No tasks yet. Create the first one!');

    act(() => {
      fakeTasksBackend.addTaskAs(ben.id, { title: 'Book dentist', type: 'meta', points: 5 });
    });

    const task = await screen.findByRole('listitem', { name: 'Book dentist' });
    expect(within(task).getByText('Added by Ben')).toBeInTheDocument();
    expect(await screen.findByText('Ben added Book dentist')).toBeInTheDocument();
  });

  it('announces new tasks on other screens too', async () => {
    logInAsFamilyMember();
    const ben = addBen();
    renderAppAt('/household');
    await screen.findByRole('heading', { level: 1, name: 'The Virtanens' });

    act(() => {
      fakeTasksBackend.addTaskAs(ben.id, { title: 'Water plants', type: 'physical', points: 2 });
    });

    expect(await screen.findByText('Ben added Water plants')).toBeInTheDocument();
  });

  it("doesn't announce the user's own tasks", async () => {
    const anna = logInAsFamilyMember();
    renderAppAt('/');
    await screen.findByText('No tasks yet. Create the first one!');

    act(() => {
      fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    });

    expect(await screen.findByRole('listitem', { name: 'Vacuum' })).toBeInTheDocument();
    expect(activityMessage()).toBeUndefined();
  });

  it('takes a task off the board when another member marks it done', async () => {
    logInAsFamilyMember();
    const ben = addBen();
    act(() => {
      fakeTasksBackend.addTaskAs(ben.id, { title: 'Vacuum', type: 'physical', points: 3 });
    });
    renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Vacuum' });

    act(() => {
      fakeTasksBackend.completeTaskAs(ben.id, 'task:0', '2026-10-08');
    });

    expect(await screen.findByText('No tasks yet. Create the first one!')).toBeInTheDocument();
  });

  it("shows a repeating task's next occurrence without announcing it as added", async () => {
    logInAsFamilyMember();
    const ben = addBen();
    fakeTasksBackend.addTaskAs(ben.id, {
      title: 'Water plants',
      type: 'physical',
      points: 2,
      repeatEveryDays: 3,
    });
    renderAppAt('/');
    await screen.findByRole('listitem', { name: 'Water plants' });

    act(() => {
      fakeTasksBackend.completeTaskAs(ben.id, 'task:0', '2030-01-01');
    });

    expect(await screen.findByText('Due Fri 4 Jan')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem', { name: 'Water plants' })).toHaveLength(1);
    expect(activityMessage()).toBeUndefined();
  });

  it("ignores other households' tasks", async () => {
    logInAsFamilyMember();
    const carol = fakeAuthBackend.addProfile('carol@example.com', 'Carol');
    fakeHouseholdBackend.addMember(carol.id, "Carol's flat");
    renderAppAt('/');
    await screen.findByText('No tasks yet. Create the first one!');

    act(() => {
      fakeTasksBackend.addTaskAs(carol.id, { title: 'Secret', type: 'physical', points: 1 });
    });

    expect(screen.queryByText(/Secret/)).not.toBeInTheDocument();
  });

  it('can be dismissed', async () => {
    const user = userEvent.setup();
    logInAsFamilyMember();
    const ben = addBen();
    renderAppAt('/');
    await screen.findByText('No tasks yet. Create the first one!');
    act(() => {
      fakeTasksBackend.addTaskAs(ben.id, { title: 'Dust', type: 'physical', points: 2 });
    });
    await screen.findByText('Ben added Dust');

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText('Ben added Dust')).not.toBeInTheDocument();
  });

  it('goes away by itself after a few seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    logInAsFamilyMember();
    const ben = addBen();
    renderAppAt('/');
    await screen.findByText('No tasks yet. Create the first one!');
    act(() => {
      fakeTasksBackend.addTaskAs(ben.id, { title: 'Dust', type: 'physical', points: 2 });
    });
    await screen.findByText('Ben added Dust');

    act(() => {
      vi.advanceTimersByTime(TASK_ACTIVITY_DURATION_MS);
    });

    expect(screen.queryByText('Ben added Dust')).not.toBeInTheDocument();
  });

  it('still announces the task when the list cannot be refreshed', async () => {
    logInAsFamilyMember();
    const ben = addBen();
    renderAppAt('/household');
    await screen.findByRole('heading', { level: 1, name: 'The Virtanens' });
    fakeTasksBackend.failRequests();

    act(() => {
      fakeTasksBackend.addTaskAs(ben.id, { title: 'Dust', type: 'physical', points: 2 });
    });

    expect(await screen.findByText('Someone added Dust')).toBeInTheDocument();
  });
});
