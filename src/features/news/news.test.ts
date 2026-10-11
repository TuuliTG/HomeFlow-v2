import { describe, expect, it } from 'vitest';

import { groupByDay, newsStart, type NewsItem } from '@/features/news/news';
import { en } from '@/locales/en';

const anna = { userId: 'u1', name: 'Anna' };
const ben = { userId: 'u2', name: 'Ben' };

/** Local time on a day in October 2026, as an ISO timestamp. */
function at(day: number, hour: number): string {
  return new Date(2026, 9, day, hour).toISOString();
}

function item(details: Partial<NewsItem> & Pick<NewsItem, 'taskId' | 'completedAt'>): NewsItem {
  return {
    title: 'Vacuum',
    type: 'physical',
    points: 3,
    doneBy: anna,
    likedBy: [],
    comments: [],
    ...details,
  };
}

describe('groupByDay', () => {
  it("groups by the local day each task was done, with each member's points that day, most first", () => {
    const items = [
      item({ taskId: 't1', completedAt: at(10, 18), doneBy: ben }),
      item({ taskId: 't2', completedAt: at(10, 9), type: 'meta', points: 2 }),
      item({ taskId: 't3', completedAt: at(10, 8), doneBy: ben, points: 5 }),
      item({ taskId: 't4', completedAt: at(9, 23) }),
      item({ taskId: 't5', completedAt: at(6, 12), points: 1 }),
    ];

    const days = groupByDay(items, '2026-10-10', en);

    expect(days.map((day) => [day.label, day.items.map((news) => news.taskId)])).toEqual([
      ['Today', ['t1', 't2', 't3']],
      ['Yesterday', ['t4']],
      ['Tue 6 Oct', ['t5']],
    ]);
    expect(days[0]?.summaries).toEqual([
      { member: ben, physicalPoints: 8, metaPoints: 0 },
      { member: anna, physicalPoints: 0, metaPoints: 2 },
    ]);
  });
});

describe('newsStart', () => {
  it('starts at local midnight six days before today, so the news covers a week', () => {
    expect(newsStart('2026-10-10')).toEqual(new Date(2026, 9, 4));
  });
});
