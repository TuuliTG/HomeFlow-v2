import { describe, expect, it } from 'vitest';

import { readyMadeTasks, withReadyMade } from '@/features/tasks/readyMadeTasks';
import { NEW_TASK_DEFAULTS, type TaskSuggestion } from '@/features/tasks/task';
import { en } from '@/locales/en';

function earlier(title: string, isOpen: boolean): TaskSuggestion {
  return { ...NEW_TASK_DEFAULTS, title, description: null, timesAdded: 1, isOpen };
}

const options = { isForChildren: false, isPrivate: false, defaultPoints: 4, earlier: [], t: en };

describe('readyMadeTasks', () => {
  it("gives adults' chores the default points and children's one star", () => {
    expect(readyMadeTasks(options)[0]).toMatchObject({ points: 4, forChildren: false });
    expect(readyMadeTasks({ ...options, isForChildren: true })[0]).toMatchObject({
      points: 1,
      forChildren: true,
    });
  });

  it('keeps a private task private and without points', () => {
    expect(readyMadeTasks({ ...options, isPrivate: true })[0]).toMatchObject({
      points: null,
      isPrivate: true,
    });
  });

  it('says which are on the board already, ignoring case', () => {
    const tasks = readyMadeTasks({
      ...options,
      earlier: [earlier('empty the DISHWASHER', true), earlier('Vacuum', false)],
    });
    const open = tasks.filter((task) => task.isOpen).map((task) => task.title);
    expect(open).toEqual(['Empty the dishwasher']);
  });
});

describe('withReadyMade', () => {
  it('lists earlier tasks first, leaving out ready-made ones the household has its own of', () => {
    const own = earlier('vacuum', false);
    const titles = withReadyMade([own], readyMadeTasks(options)).map((task) => task.title);
    expect(titles[0]).toBe('vacuum');
    expect(titles).not.toContain('Vacuum');
    expect(titles).toContain('Empty the dishwasher');
  });
});
