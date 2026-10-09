import { describe, expect, it } from 'vitest';

import {
  byMostContributed,
  fairnessOf,
  type MemberContribution,
  periodStart,
} from '@/features/statistics/statistics';

const anna = { userId: 'anna', displayName: 'Anna', done: 0, created: 0 };

function contribution(done: number, created: number): MemberContribution {
  return { ...anna, done, created };
}

describe('periodStart', () => {
  it('starts the week on Monday at midnight', () => {
    expect(periodStart('week', new Date(2026, 9, 9, 15, 30))).toEqual(new Date(2026, 9, 5));
    expect(periodStart('week', new Date(2026, 9, 11, 23, 0))).toEqual(new Date(2026, 9, 5));
    expect(periodStart('week', new Date(2026, 9, 5, 0, 0))).toEqual(new Date(2026, 9, 5));
  });

  it('starts the month on the first, and all time has no start', () => {
    expect(periodStart('month', new Date(2026, 9, 9, 15, 30))).toEqual(new Date(2026, 9, 1));
    expect(periodStart('all', new Date(2026, 9, 9))).toBeNull();
  });
});

describe('byMostContributed', () => {
  it('puts whoever did and added most first, keeping ties in order', () => {
    const ben = { ...anna, userId: 'ben', displayName: 'Ben' };
    const carl = { ...anna, userId: 'carl', displayName: 'Carl' };

    expect(
      byMostContributed([
        { ...anna, done: 1, created: 0 },
        { ...ben, done: 2, created: 3 },
        { ...carl, done: 0, created: 1 },
      ]).map(({ displayName }) => displayName),
    ).toEqual(['Ben', 'Anna', 'Carl']);
  });
});

describe('fairnessOf', () => {
  it('is 100 and balanced when everyone did as much', () => {
    expect(fairnessOf([contribution(2, 1), contribution(1, 2)])).toEqual({
      score: 100,
      label: 'Balanced',
    });
  });

  it('is 0 when one member did everything', () => {
    expect(fairnessOf([contribution(3, 2), contribution(0, 0), contribution(0, 0)])).toEqual({
      score: 0,
      label: 'Uneven',
    });
  });

  it('falls in between for uneven shares', () => {
    expect(fairnessOf([contribution(3, 0), contribution(1, 0)])).toEqual({
      score: 50,
      label: 'Slightly uneven',
    });
    expect(fairnessOf([contribution(9, 0), contribution(1, 0)])).toEqual({
      score: 20,
      label: 'Uneven',
    });
  });

  it('has no score for a single member or when nothing has been done', () => {
    expect(fairnessOf([contribution(3, 1)])).toBeNull();
    expect(fairnessOf([contribution(0, 0), contribution(0, 0)])).toBeNull();
  });
});
