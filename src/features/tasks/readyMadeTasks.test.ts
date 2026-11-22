import { describe, expect, it } from 'vitest';

import { nameSuggestions, readyMadeTasks } from '@/features/tasks/readyMadeTasks';
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

describe('nameSuggestions', () => {
  it('lists earlier tasks first, leaving out ready-made ones the household has its own of', () => {
    const own = earlier('vacuum', false);
    const titles = nameSuggestions(
      { earlier: [own], readyMade: readyMadeTasks(options), favouriteKeys: [] },
      '',
    ).map((task) => task.title);
    expect(titles[0]).toBe('vacuum');
    expect(titles).not.toContain('Vacuum');
    expect(titles).toContain('Empty the dishwasher');
  });

  it('lists only the most often added earlier tasks before a name is typed, and every ready-made one', () => {
    const own = ['a', 'b', 'c', 'd', 'e', 'f'].map((title) => earlier(title, false));
    const titles = nameSuggestions(
      { earlier: own, readyMade: readyMadeTasks(options), favouriteKeys: [] },
      '',
    ).map((task) => task.title);
    expect(titles.slice(0, 6)).toEqual(['a', 'b', 'c', 'd', 'e', 'Empty the dishwasher']);
    expect(titles).toHaveLength(5 + readyMadeTasks(options).length);
  });

  it('lists the earlier and ready-made tasks matching a typed name', () => {
    const own = earlier('Clean the car', false);
    const titles = nameSuggestions(
      { earlier: [own], readyMade: readyMadeTasks(options), favouriteKeys: [] },
      'clean',
    ).map((task) => task.title);
    expect(titles).toEqual(['Clean the car', 'Clean the bathroom', 'Clean the kitchen']);
  });

  it('lists the favourites first by name, earlier or ready-made, and not again after them', () => {
    const own = ['a', 'Water the car'].map((title) => earlier(title, false));
    const titles = nameSuggestions(
      {
        earlier: own,
        readyMade: readyMadeTasks(options),
        favouriteKeys: ['water the car', 'vacuum'],
      },
      '',
    ).map((task) => task.title);
    expect(titles.slice(0, 3)).toEqual(['Vacuum', 'Water the car', 'a']);
    expect(titles.filter((title) => title === 'Vacuum')).toHaveLength(1);
    const typed = nameSuggestions(
      { earlier: own, readyMade: readyMadeTasks(options), favouriteKeys: ['water the car'] },
      'water',
    );
    expect(typed.map((task) => task.title)).toEqual(['Water the car', 'Water the plants']);
  });
});
