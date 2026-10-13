import { describe, expect, it } from 'vitest';

import { daysBetween } from '@/lib/dates';

describe('daysBetween', () => {
  it('counts whole calendar days, negative backwards', () => {
    expect(daysBetween('2026-10-05', '2026-10-08')).toBe(3);
    expect(daysBetween('2026-10-08', '2026-10-08')).toBe(0);
    expect(daysBetween('2026-10-08', '2026-10-05')).toBe(-3);
    expect(daysBetween('2026-09-30', '2026-10-01')).toBe(1);
  });

  it('counts a day with a daylight saving change as one day', () => {
    // Clocks change on the last Sunday of October in Europe and early November in the US.
    expect(daysBetween('2026-10-24', '2026-11-02')).toBe(9);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });
});
