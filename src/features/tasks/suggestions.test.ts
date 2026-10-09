import { describe, expect, it } from 'vitest';

import {
  findSuggestion,
  MATCHING_SUGGESTIONS_LIMIT,
  matchingSuggestions,
  suggestionAsTask,
  suggestionPointsLabel,
} from '@/features/tasks/suggestions';
import type { TaskSuggestion } from '@/features/tasks/task';

function suggestion(title: string, details: Partial<TaskSuggestion> = {}): TaskSuggestion {
  return {
    title,
    description: null,
    type: 'physical',
    points: 1,
    repeatEveryDays: null,
    isPrivate: false,
    timesAdded: 1,
    isOpen: false,
    ...details,
  };
}

const suggestions = [
  suggestion('Take out trash'),
  suggestion('Vacuum'),
  suggestion('Sort the trash'),
];

describe('matchingSuggestions', () => {
  it('finds tasks whose name contains what was typed, ignoring case, in the given order', () => {
    expect(matchingSuggestions(suggestions, '  TRASH').map((match) => match.title)).toEqual([
      'Take out trash',
      'Sort the trash',
    ]);
  });

  it.each(['', '   '])('suggests nothing before anything is typed (%j)', (query) => {
    expect(matchingSuggestions(suggestions, query)).toEqual([]);
  });

  it('lists only the first few matches', () => {
    const many = Array.from({ length: 8 }, (_, index) => suggestion(`Task ${String(index)}`));
    expect(matchingSuggestions(many, 'task')).toHaveLength(MATCHING_SUGGESTIONS_LIMIT);
  });
});

describe('findSuggestion', () => {
  it('finds the task with exactly that name, ignoring case and surrounding spaces', () => {
    expect(findSuggestion(suggestions, ' vacuum ')?.title).toBe('Vacuum');
    expect(findSuggestion(suggestions, 'Vac')).toBeUndefined();
  });
});

describe('suggestionAsTask', () => {
  it("copies the task's details without a due date", () => {
    const details = {
      description: 'The bins are behind the garage',
      type: 'meta',
      points: 2,
      repeatEveryDays: 7,
      timesAdded: 4,
      isOpen: true,
    } as const;
    expect(suggestionAsTask(suggestion('Take out trash', details))).toEqual({
      title: 'Take out trash',
      description: 'The bins are behind the garage',
      type: 'meta',
      points: 2,
      repeatEveryDays: 7,
      isPrivate: false,
      dueOn: null,
    });
  });

  it('keeps a private task private and without points', () => {
    expect(
      suggestionAsTask(suggestion('Buy a present', { points: null, isPrivate: true })),
    ).toMatchObject({
      points: null,
      isPrivate: true,
    });
  });
});

describe('suggestionPointsLabel', () => {
  it.each([
    [1, '1 point'],
    [3, '3 points'],
    [null, 'Private'],
  ])('labels %j points as %s', (points, label) => {
    expect(suggestionPointsLabel(suggestion('Dust', { points }))).toBe(label);
  });
});
