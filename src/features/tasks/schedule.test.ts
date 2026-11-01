import { describe, expect, it } from 'vitest';

import {
  atMinutes,
  daysShown,
  endOf,
  placeBlocks,
  snapStart,
  startFromLink,
  startOfWeek,
  suggestedStart,
  tappedStart,
} from '@/features/tasks/schedule';

function block(isoDate: string, start: string, durationMinutes: number) {
  const [hours = 0, minutes = 0] = start.split(':').map(Number);
  return { startsAt: atMinutes(isoDate, hours * 60 + minutes).toISOString(), durationMinutes };
}

describe('startOfWeek', () => {
  it('is the Monday of the week', () => {
    expect(startOfWeek('2026-10-17')).toBe('2026-10-12'); // Saturday
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12'); // Sunday
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12'); // Monday
  });
});

describe('daysShown', () => {
  it('is the day itself, or its week from Monday to Sunday', () => {
    expect(daysShown('day', '2026-10-17')).toEqual(['2026-10-17']);
    expect(daysShown('week', '2026-10-17')).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
  });
});

describe('snapStart', () => {
  it('rounds to the nearest quarter of an hour', () => {
    expect(snapStart(9 * 60 + 7, 30)).toBe(9 * 60);
    expect(snapStart(9 * 60 + 8, 30)).toBe(9 * 60 + 15);
  });

  it('keeps the whole block within the day', () => {
    expect(snapStart(-20, 30)).toBe(0);
    expect(snapStart(23 * 60 + 50, 30)).toBe(23 * 60 + 30);
    expect(snapStart(23 * 60, 50)).toBe(23 * 60);
  });
});

describe('placeBlocks', () => {
  const day = '2026-10-17';

  it('shows the blocks starting that day, earliest first, in minutes into the day', () => {
    const placed = placeBlocks(
      [block(day, '18:00', 60), block('2026-10-18', '09:00', 30), block(day, '07:30', 45)],
      day,
    );
    expect(placed.map(({ top, bottom, lane, lanes }) => ({ top, bottom, lane, lanes }))).toEqual([
      { top: 450, bottom: 495, lane: 0, lanes: 1 },
      { top: 1080, bottom: 1140, lane: 0, lanes: 1 },
    ]);
  });

  it('cuts a block off at midnight', () => {
    expect(placeBlocks([block(day, '23:00', 120)], day)[0]?.bottom).toBe(24 * 60);
  });

  it('puts overlapping blocks side by side', () => {
    const placed = placeBlocks(
      [
        block(day, '09:00', 60),
        block(day, '09:30', 60),
        block(day, '10:00', 30),
        block(day, '12:00', 30),
      ],
      day,
    );
    expect(placed.map(({ lane, lanes }) => [lane, lanes])).toEqual([
      [0, 2],
      [1, 2],
      // 9:00–10:00 has ended, so 10:00 takes the first lane again.
      [0, 2],
      [0, 1],
    ]);
  });
});

describe('endOf', () => {
  it('is the start plus the length', () => {
    const start = block('2026-10-17', '09:00', 45);
    expect(endOf(start)).toEqual(atMinutes('2026-10-17', 9 * 60 + 45));
  });
});

describe('suggestedStart', () => {
  it('is the next full hour today', () => {
    expect(suggestedStart('2026-10-17', new Date(2026, 9, 17, 14, 20))).toEqual(
      new Date(2026, 9, 17, 15, 0),
    );
  });

  it('is the last hour of the day late in the evening', () => {
    expect(suggestedStart('2026-10-17', new Date(2026, 9, 17, 23, 20))).toEqual(
      new Date(2026, 9, 17, 23, 0),
    );
  });

  it('is 9:00 on another day', () => {
    expect(suggestedStart('2026-10-18', new Date(2026, 9, 17, 14, 20))).toEqual(
      new Date(2026, 9, 18, 9, 0),
    );
  });
});

describe('tappedStart', () => {
  it('is the start of the quarter of an hour tapped', () => {
    expect(tappedStart(14 * 60 + 14)).toBe(14 * 60);
    expect(tappedStart(14 * 60 + 15)).toBe(14 * 60 + 15);
  });

  it('leaves room for a block of the default length before midnight', () => {
    expect(tappedStart(23 * 60 + 50)).toBe(23 * 60 + 30);
    expect(tappedStart(-5)).toBe(0);
  });
});

describe('startFromLink', () => {
  it('is the time in the link', () => {
    expect(startFromLink(new URLSearchParams('at=2026-10-18T12:00:00.000Z'))).toBe(
      '2026-10-18T12:00:00.000Z',
    );
  });

  it('is null without a time', () => {
    expect(startFromLink(new URLSearchParams(''))).toBeNull();
    expect(startFromLink(new URLSearchParams('at=tomorrow'))).toBeNull();
  });
});
