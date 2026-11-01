import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HELPERS_WINDOW_MS } from '@/features/tasks/task';
import { WHO_HELPED_PROMPT_DURATION_MS } from '@/features/tasks/WhoHelpedPrompt';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHelpersBackend } from '@/test/fakeHelpersApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

function addMember(email: string, name: string, isChild = false) {
  const member = fakeAuthBackend.addProfile(email, name);
  fakeHouseholdBackend.addMember(member.id, 'The Virtanens');
  fakeHouseholdBackend.setChild(member.id, isChild);
  return member;
}

/** Anna did the laundry, an adults-only task worth 5 points; Ben (a child) and Dan live with her. */
function annaDidTheLaundry() {
  const anna = logInAsFamilyMember();
  const ben = addMember('ben@example.com', 'Ben', true);
  const dan = addMember('dan@example.com', 'Dan');
  fakeTasksBackend.addTaskAs(anna.id, { title: 'Laundry', type: 'physical', points: 5 });
  fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-11');
  return { anna, ben, dan };
}

async function findCompleted(title: string) {
  const list = await screen.findByRole('list', { name: 'Completed tasks' });
  return within(list)
    .findByText(title)
    .then((text) => text.closest('li') as HTMLElement);
}

describe('helping with a task', () => {
  it("gives a helper some of the task's points from the Me page", async () => {
    annaDidTheLaundry();
    const user = userEvent.setup();
    const { router } = renderAppAt('/me');

    await user.click(await screen.findByRole('link', { name: 'Who helped with Laundry?' }));

    expect(await screen.findByRole('heading', { name: 'Who helped?' })).toBeInTheDocument();
    expect(screen.getByText(/Share Laundry's 5 points/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Anna helped' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Ben helped' }));
    // An even split by default, which the user can change.
    expect(screen.getByRole('combobox', { name: 'Points for Ben' })).toHaveValue('2');
    expect(screen.getByText('You keep 3 points.')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Points for Ben' }), '1');
    expect(screen.getByText('You keep 4 points.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(router.state.location.pathname).toBe('/me');
    const laundry = await findCompleted('Laundry');
    expect(laundry).toHaveTextContent('4 points');
    expect(laundry).toHaveTextContent('Helped by Ben (1 point)');
    const points = screen.getByRole('region', { name: 'Points earned' });
    expect(await within(points).findByText('4')).toBeInTheDocument();
  });

  it('credits the helper, also a child who cannot see the task', async () => {
    const { anna, ben, dan } = annaDidTheLaundry();
    fakeHelpersBackend.setHelpersAs(anna.id, 'task:0', [
      { userId: ben.id, points: 2 },
      { userId: dan.id, points: 2 },
    ]);
    fakeAuthBackend.logInAs('dan@example.com');
    const { unmount } = renderAppAt('/me');

    const points = await screen.findByRole('region', { name: 'Points earned' });
    expect(await within(points).findByText('2')).toBeInTheDocument();
    unmount();

    // A child's Me page shows their share under the tasks they have done.
    fakeAuthBackend.logInAs('ben@example.com');
    renderAppAt('/me');

    const laundry = await findCompleted('Laundry');
    expect(within(laundry).getByText('You helped Anna')).toBeInTheDocument();
    expect(within(laundry).getByText(/2 points/)).toBeInTheDocument();
  });

  it('shares a task between adults evenly, and shows who helped on the board', async () => {
    annaDidTheLaundry();
    const user = userEvent.setup();
    const { router } = renderAppAt('/tasks/task:0/helpers');

    await user.click(await screen.findByRole('checkbox', { name: 'Dan helped' }));
    await user.click(screen.getByRole('checkbox', { name: 'Ben helped' }));
    expect(screen.getByRole('combobox', { name: 'Points for Dan' })).toHaveValue('2');
    expect(screen.getByRole('combobox', { name: 'Points for Ben' })).toHaveValue('1');
    await user.click(screen.getByRole('checkbox', { name: 'Ben helped' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await findCompleted('Laundry');

    await router.navigate('/?completed=1');
    // The list may render again as the board loads, so look it up afresh each time.
    await waitFor(() => {
      const completed = screen.getByRole('region', { name: 'Completed' });
      expect(within(completed).getByText('Helped by Dan (2 points)')).toBeInTheDocument();
    });
  });

  it("won't give away more than the task's points", async () => {
    annaDidTheLaundry();
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/helpers');

    await user.click(await screen.findByRole('checkbox', { name: 'Ben helped' }));
    await user.click(screen.getByRole('checkbox', { name: 'Dan helped' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Points for Ben' }), '5');

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Together that's more than the task's 5 points.",
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('changes or removes helpers chosen before', async () => {
    const { anna, ben } = annaDidTheLaundry();
    fakeHelpersBackend.setHelpersAs(anna.id, 'task:0', [{ userId: ben.id, points: 3 }]);
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/helpers');

    const benHelped = await screen.findByRole('checkbox', { name: 'Ben helped' });
    expect(benHelped).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Points for Ben' })).toHaveValue('3');
    await user.click(benHelped);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const laundry = await findCompleted('Laundry');
    expect(laundry).toHaveTextContent('5 points');
    expect(laundry).not.toHaveTextContent('Helped by');
  });

  it('explains when saving fails, keeping the choices', async () => {
    annaDidTheLaundry();
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/helpers');
    await user.click(await screen.findByRole('checkbox', { name: 'Ben helped' }));
    fakeTasksBackend.failRequests();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save who helped.");
    expect(screen.getByRole('checkbox', { name: 'Ben helped' })).toBeChecked();
  });

  it('offers helpers only for a week, and only for shared tasks with points', async () => {
    const anna = logInAsFamilyMember();
    addMember('ben@example.com', 'Ben');
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Old chore', type: 'physical', points: 2 });
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-01');
    fakeTasksBackend.ageCompletions(HELPERS_WINDOW_MS);
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Buy a present',
      type: 'meta',
      points: null,
      isPrivate: true,
    });
    fakeTasksBackend.completeTaskAs(anna.id, 'task:1', '2026-10-11');
    const { router } = renderAppAt('/me');

    await findCompleted('Old chore');
    await findCompleted('Buy a present');
    expect(screen.queryByRole('link', { name: /Who helped/ })).not.toBeInTheDocument();

    await router.navigate('/tasks/task:0/helpers');
    expect(
      await screen.findByText(/You can say who helped for a week after marking/),
    ).toBeInTheDocument();
  });

  it('says so when nobody else is in the household', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Laundry', type: 'physical', points: 5 });
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-11');
    renderAppAt('/tasks/task:0/helpers');

    expect(await screen.findByText('Nobody else is in your household yet.')).toBeInTheDocument();
  });

  it('shows a helper the tasks they helped with on their Me page, without the task on their board', async () => {
    const { anna, ben } = annaDidTheLaundry();
    fakeHelpersBackend.setHelpersAs(anna.id, 'task:0', [{ userId: ben.id, points: 2 }]);
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Feed the cat',
      type: 'physical',
      points: 1,
      forChildren: true,
    });
    fakeTasksBackend.completeTaskAs(anna.id, 'task:1', '2026-10-11');
    fakeAuthBackend.logInAs('ben@example.com');
    const { router } = renderAppAt('/me');

    const laundry = await findCompleted('Laundry');
    expect(laundry).toHaveTextContent('2 points');
    expect(laundry).toHaveTextContent('You helped Anna');
    expect(within(laundry).queryByRole('button', { name: /Undo/ })).not.toBeInTheDocument();
    expect(within(laundry).queryByRole('link', { name: /Who helped/ })).not.toBeInTheDocument();

    // Ben is a child and Laundry is for adults: it stays off his board.
    await router.navigate('/?completed=1');
    expect(await screen.findByText('Feed the cat')).toBeInTheDocument();
    expect(screen.queryByText('Laundry')).not.toBeInTheDocument();
  });

  it('explains when the task or the household cannot be loaded', async () => {
    annaDidTheLaundry();
    fakeTasksBackend.failRequests();
    renderAppAt('/tasks/task:0/helpers');

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the task");
  });
});

describe('asking who helped after marking a task done', () => {
  async function markDone(title: string) {
    const user = userEvent.setup();
    const result = renderAppAt('/');
    await user.click(await screen.findByRole('button', { name: `Mark done: ${title}` }));
    return { user, ...result };
  }

  it('asks right away, and links to sharing the points', async () => {
    const anna = logInAsFamilyMember();
    addMember('ben@example.com', 'Ben', true);
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Laundry', type: 'physical', points: 5 });
    const { user, router } = await markDone('Laundry');

    expect(await screen.findByText('Laundry done! Did someone help?')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Who helped with Laundry?' }));

    expect(router.state.location.pathname).toBe('/tasks/task:0/helpers');
    expect(await screen.findByRole('checkbox', { name: 'Ben helped' })).toBeInTheDocument();
    expect(screen.queryByText('Laundry done! Did someone help?')).not.toBeInTheDocument();
  });

  it('goes away when dismissed, or after a while', async () => {
    const anna = logInAsFamilyMember();
    addMember('ben@example.com', 'Ben');
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Laundry', type: 'physical', points: 5 });
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Dishes', type: 'physical', points: 2 });
    const { user } = await markDone('Laundry');

    await screen.findByText('Laundry done! Did someone help?');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Laundry done! Did someone help?')).not.toBeInTheDocument();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await user.click(screen.getByRole('button', { name: 'Mark done: Dishes' }));
      await screen.findByText('Dishes done! Did someone help?');
      act(() => {
        vi.advanceTimersByTime(WHO_HELPED_PROMPT_DURATION_MS);
      });
      expect(screen.queryByText('Dishes done! Did someone help?')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not ask for a private task, or when nobody else is in the household', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Laundry', type: 'physical', points: 5 });
    await markDone('Laundry');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Mark done: Laundry' })).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/Did someone help/)).not.toBeInTheDocument();
  });
});
