import { describe, expect, it } from 'vitest';

import { CUSTOM_REPEAT, repeatDays, repeatFieldValue } from '@/features/tasks/taskRepeat';

describe('repeatFieldValue', () => {
  it('leaves a one-off task without a repeat', () => {
    expect(repeatFieldValue(null)).toEqual({ choice: '', count: '', unit: 'days' });
  });

  it('picks a ready-made choice when there is one', () => {
    expect(repeatFieldValue(14)).toEqual({ choice: '14', count: '', unit: 'days' });
  });

  it('counts other intervals in weeks when they are whole weeks, otherwise in days', () => {
    expect(repeatFieldValue(21)).toEqual({ choice: CUSTOM_REPEAT, count: '3', unit: 'weeks' });
    expect(repeatFieldValue(10)).toEqual({ choice: CUSTOM_REPEAT, count: '10', unit: 'days' });
  });
});

describe('repeatDays', () => {
  it('turns the fields back into days', () => {
    expect(repeatDays({ choice: '', count: '5', unit: 'days' })).toBeNull();
    expect(repeatDays({ choice: '7', count: '5', unit: 'days' })).toBe(7);
    expect(repeatDays({ choice: CUSTOM_REPEAT, count: '5', unit: 'days' })).toBe(5);
    expect(repeatDays({ choice: CUSTOM_REPEAT, count: '5', unit: 'weeks' })).toBe(35);
  });

  it('gives NaN for a custom interval left empty', () => {
    expect(repeatDays({ choice: CUSTOM_REPEAT, count: ' ', unit: 'days' })).toBeNaN();
  });

  it('round-trips every interval a task can have', () => {
    for (let days = 1; days <= 365; days++) {
      expect(repeatDays(repeatFieldValue(days))).toBe(days);
    }
  });
});
