import { describe, expect, it } from 'vitest';

import {
  comparedMembers,
  comparisonOf,
  fairnessOf,
  groupOf,
  hasMemberGroups,
  type MemberContribution,
  periodStart,
  rankBy,
} from '@/features/statistics/statistics';

const anna: MemberContribution = {
  userId: 'anna',
  displayName: 'Anna',
  isChild: false,
  done: 0,
  points: 0,
  physicalDone: 0,
  physicalPoints: 0,
  metaDone: 0,
  metaPoints: 0,
  created: 0,
};

function points(earned: number): MemberContribution {
  return { ...anna, points: earned };
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

describe('rankBy', () => {
  it('puts whoever has most of the metric first, keeping ties in the order they joined', () => {
    const ben = { ...anna, userId: 'ben', displayName: 'Ben' };
    const carl = { ...anna, userId: 'carl', displayName: 'Carl' };
    const contributions = [
      { ...anna, points: 3, created: 2 },
      { ...ben, points: 8, created: 0 },
      { ...carl, points: 3, created: 5 },
    ];
    const names = (ranked: MemberContribution[]) => ranked.map(({ displayName }) => displayName);

    expect(names(rankBy(contributions, 'points'))).toEqual(['Ben', 'Anna', 'Carl']);
    expect(names(rankBy(contributions, 'created'))).toEqual(['Carl', 'Anna', 'Ben']);
  });
});

describe('fairnessOf', () => {
  it('is 100 and balanced when everyone has as much', () => {
    expect(fairnessOf([points(4), points(4)], 'points')).toEqual({ score: 100, label: 'balanced' });
  });

  it('is 0 when one member has it all', () => {
    expect(fairnessOf([points(5), points(0), points(0)], 'points')).toEqual({
      score: 0,
      label: 'uneven',
    });
  });

  it('falls in between for uneven shares', () => {
    expect(fairnessOf([points(3), points(1)], 'points')).toEqual({
      score: 50,
      label: 'slightlyUneven',
    });
    expect(fairnessOf([points(9), points(1)], 'points')).toEqual({ score: 20, label: 'uneven' });
  });

  it('scores each metric on its own', () => {
    const contributions = [
      { ...anna, points: 10, created: 1 },
      { ...anna, points: 0, created: 1 },
    ];

    expect(fairnessOf(contributions, 'points')?.score).toBe(0);
    expect(fairnessOf(contributions, 'created')?.score).toBe(100);
  });

  it('has no score for a single member or when there is nothing yet', () => {
    expect(fairnessOf([points(3)], 'points')).toBeNull();
    expect(fairnessOf([points(0), points(0)], 'points')).toBeNull();
  });
});

describe('comparing members', () => {
  const ben = { ...anna, userId: 'ben', displayName: 'Ben' };
  const cleo = { ...anna, userId: 'cleo', displayName: 'Cleo', isChild: true };
  const dan = { ...anna, userId: 'dan', displayName: 'Dan', isChild: true };
  const family = [anna, ben, cleo, dan];

  it('compares everyone, only the adults, only the children, or members chosen one by one', () => {
    expect(comparedMembers(family, 'everyone')).toEqual(family);
    expect(comparedMembers(family, 'adults')).toEqual([anna, ben]);
    expect(comparedMembers(family, 'children')).toEqual([cleo, dan]);
    expect(comparedMembers(family, ['dan', 'anna'])).toEqual([anna, dan]);
  });

  it('compares everyone when no one matches', () => {
    expect(comparedMembers([anna, ben], 'children')).toEqual([anna, ben]);
    expect(comparedMembers(family, ['someone-who-left'])).toEqual(family);
  });

  it('names the group the members make, if any', () => {
    expect(groupOf(family, family)).toBe('everyone');
    expect(groupOf(family, [cleo, dan])).toBe('children');
    expect(groupOf(family, [anna, cleo])).toBeNull();
  });

  it('compares members as a group when they make one, otherwise one by one', () => {
    expect(comparisonOf(family, [anna, ben])).toBe('adults');
    expect(comparisonOf(family, family)).toBe('everyone');
    expect(comparisonOf(family, [anna, cleo, dan])).toEqual(['anna', 'cleo', 'dan']);
  });

  it('has groups to compare only with both adults and children', () => {
    expect(hasMemberGroups(family)).toBe(true);
    expect(hasMemberGroups([anna, ben])).toBe(false);
    expect(hasMemberGroups([cleo, dan])).toBe(false);
  });
});
