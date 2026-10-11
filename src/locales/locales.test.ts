import { describe, expect, it } from 'vitest';

import { en, type Messages } from '@/locales/en';
import { fi } from '@/locales/fi';

/** Every plain text in a language, by its path ("tasks.card.edit"). */
function texts(messages: object, path = ''): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]: [string, unknown]) => {
    const at = path ? `${path}.${key}` : key;
    if (typeof value === 'string') return [[at, value]];
    return value && typeof value === 'object' ? texts(value, at) : [];
  });
}

describe.each([
  ['en', en],
  ['fi', fi],
] as [string, Messages][])('%s', (_code, messages) => {
  it('leaves no text empty', () => {
    for (const [path, text] of texts(messages)) expect(text, path).not.toBe('');
  });
});

/** Thursday 8 October 2026, 9:05. */
const date = new Date(2026, 9, 8, 9, 5);

describe('English', () => {
  it('formats dates and times', () => {
    expect(en.common.shortDate(date)).toBe('Thu 8 Oct');
    expect(en.common.dayAndMonth(date)).toBe('8 Oct');
    expect(en.common.time(date)).toBe('9:05');
  });

  it('counts points and lists names like a sentence', () => {
    expect(en.common.points(1)).toBe('1 point');
    expect(en.common.points(3)).toBe('3 points');
    expect(en.common.joinNames(['Anna'])).toBe('Anna');
    expect(en.common.joinNames(['You', 'Ben'])).toBe('You and Ben');
    expect(en.common.joinNames(['Anna', 'Ben', 'Carl'])).toBe('Anna, Ben and Carl');
  });

  it('describes how often a task repeats', () => {
    expect([1, 3, 7, 14].map(en.tasks.repeat)).toEqual([
      'Every day',
      'Every 3 days',
      'Every week',
      'Every 2 weeks',
    ]);
  });

  it("names the kind of work in a day's points when there was only one, and splits it otherwise", () => {
    expect(en.news.summary('Ben', 10, 0)).toBe('Ben earned 10 points of physical work');
    expect(en.news.summary('You', 0, 1)).toBe('You earned 1 point of meta work');
    expect(en.news.summary('Ben', 7, 3)).toBe('Ben earned 10 points: 7 physical, 3 meta work');
  });
});

describe('Finnish', () => {
  it('formats dates and times the Finnish way', () => {
    expect(fi.common.shortDate(date)).toBe('to 8.10.');
    expect(fi.common.dayAndMonth(date)).toBe('8.10.');
    expect(fi.common.time(date)).toBe('9.05');
  });

  it('counts points and lists names', () => {
    expect(fi.common.points(1)).toBe('1 piste');
    expect(fi.common.points(3)).toBe('3 pistettä');
    expect(fi.common.joinNames(['Anna', 'Ben', 'Carl'])).toBe('Anna, Ben ja Carl');
  });

  it('describes how often a task repeats', () => {
    expect([1, 3, 7, 14].map(fi.tasks.repeat)).toEqual([
      'Joka päivä',
      '3 päivän välein',
      'Joka viikko',
      '2 viikon välein',
    ]);
  });

  it("splits a day's points by the kind of work", () => {
    expect(fi.news.summary('Sinä', 7, 3)).toBe('Sinä: 10 pistettä (7 fyysistä, 3 metatyötä)');
  });
});
