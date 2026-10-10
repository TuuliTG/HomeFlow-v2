import { describe, expect, it } from 'vitest';

import { groupByDueDate } from '@/features/tasks/dueDate';

/** Wednesday 7 October 2026. */
const TODAY = '2026-10-07';

function titlesByGroup(dueDates: (string | null)[]) {
  const items = dueDates.map((dueOn, index) => ({ title: String(index), dueOn }));
  return groupByDueDate(items, TODAY).map(({ label, items: grouped }) => [
    label,
    grouped.map((item) => item.dueOn),
  ]);
}

describe('groupByDueDate', () => {
  it('groups by overdue, today, tomorrow, each day of the coming week, later and no due date', () => {
    expect(
      titlesByGroup([
        '2026-09-30',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
        '2026-10-13',
        '2026-10-14',
        '2026-12-24',
        null,
      ]),
    ).toEqual([
      ['Overdue', ['2026-09-30', '2026-10-06']],
      ['Today', ['2026-10-07']],
      ['Tomorrow', ['2026-10-08']],
      ['Fri 9 Oct', ['2026-10-09']],
      ['Tue 13 Oct', ['2026-10-13']],
      ['Later', ['2026-10-14', '2026-12-24']],
      ['No due date', [null]],
    ]);
  });

  it('leaves out groups with nothing in them', () => {
    expect(titlesByGroup(['2026-10-08', null])).toEqual([
      ['Tomorrow', ['2026-10-08']],
      ['No due date', [null]],
    ]);
  });

  it('keeps the order of the items within a group', () => {
    const items = [
      { title: 'Vacuum', dueOn: '2026-10-07' },
      { title: 'Dust', dueOn: '2026-10-07' },
    ];
    expect(groupByDueDate(items, TODAY)[0]?.items).toEqual(items);
  });

  it('crosses month and year ends', () => {
    expect(
      groupByDueDate([{ dueOn: '2027-01-01' }, { dueOn: '2027-01-02' }], '2026-12-31').map(
        (group) => group.label,
      ),
    ).toEqual(['Tomorrow', 'Sat 2 Jan']);
  });
});
