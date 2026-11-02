import { describe, expect, it } from 'vitest';

import { type Goal, jarFill } from '@/features/rewards/goal';

const ben = 'ben';

function sharedGoal(benPoints: number, othersPoints: number, benMinimum: number | null): Goal {
  return {
    id: 'goal',
    title: 'Sushi dinner',
    targetPoints: 60,
    owner: null,
    points: benPoints + othersPoints,
    participants: [
      { id: 'anna', name: 'Anna', points: othersPoints, minPoints: null },
      { id: ben, name: 'Ben', points: benPoints, minPoints: benMinimum },
    ],
    reached: false,
    claimedAt: null,
  };
}

describe('jarFill', () => {
  it("keeps room for a participant's minimum that others' points don't fill", () => {
    expect(jarFill(sharedGoal(2, 58, 15), ben)).toEqual({ ownRoom: 15, own: 2, others: 45 });
  });

  it('counts their points past the minimum with everyone else', () => {
    expect(jarFill(sharedGoal(20, 30, 15), ben)).toEqual({ ownRoom: 15, own: 15, others: 35 });
  });

  it('keeps no room without a minimum, or for someone not taking part', () => {
    expect(jarFill(sharedGoal(2, 70, null), ben)).toEqual({ ownRoom: 0, own: 0, others: 60 });
    expect(jarFill(sharedGoal(2, 30, 15), 'carl')).toEqual({ ownRoom: 0, own: 0, others: 32 });
  });
});
