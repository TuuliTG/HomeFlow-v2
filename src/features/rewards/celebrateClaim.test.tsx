import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CLAIM_CELEBRATION_DURATION_MS } from '@/features/rewards/RewardCelebration';
import { fakeGoalsBackend } from '@/test/fakeGoalsApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

/** Sets reached goals for the logged-in user and opens the Rewards screen. */
function renderReachedGoals(...titles: string[]) {
  const anna = logInAsFamilyMember();
  titles.forEach((title, index) => {
    fakeGoalsBackend.addGoalAs(anna.id, { title, targetPoints: 5, isShared: index === 0 });
  });
  const vacuum = fakeTasksBackend.addTaskAs(anna.id, {
    title: 'Vacuum',
    type: 'physical',
    points: 5,
  });
  fakeTasksBackend.completeTaskAs(anna.id, vacuum, '2026-10-10');
  const user = userEvent.setup();
  renderAppAt('/rewards');
  return user;
}

async function claim(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(await screen.findByRole('button', { name: `Claim reward: ${title}` }));
}

describe('celebrating a claimed reward', () => {
  it('throws confetti and says the reward is claimed', async () => {
    const user = renderReachedGoals('Pizza night');

    await claim(user, 'Pizza night');

    expect(await screen.findByText('Reward claimed: Pizza night!')).toBeInTheDocument();
    // The confetti and badge are decorative; screen readers hear the text above instead.
    expect(screen.getByText('Reward claimed!').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("isn't shown when the claim fails", async () => {
    const user = renderReachedGoals('Pizza night');
    const button = await screen.findByRole('button', { name: 'Claim reward: Pizza night' });
    fakeGoalsBackend.claimAs('goal:0');

    await user.click(button);

    expect(await screen.findByRole('region', { name: 'Rewards claimed' })).toBeInTheDocument();
    expect(screen.queryByText('Reward claimed!')).not.toBeInTheDocument();
    expect(screen.queryByText(/Reward claimed:/)).not.toBeInTheDocument();
  });

  it('goes away by itself, and comes back for the next reward', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = renderReachedGoals('Pizza night', 'New book');
      await claim(user, 'Pizza night');
      await screen.findByText('Reward claimed!');
      act(() => {
        vi.advanceTimersByTime(CLAIM_CELEBRATION_DURATION_MS);
      });
      expect(screen.queryByText('Reward claimed!')).not.toBeInTheDocument();

      await claim(user, 'New book');
      expect(await screen.findByText('Reward claimed: New book!')).toBeInTheDocument();
      expect(screen.getByText('Reward claimed!')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
