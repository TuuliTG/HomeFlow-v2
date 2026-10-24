import { describe, expect, it } from 'vitest';

import type { Task } from '@/features/tasks/task';
import {
  filterTasks,
  parseTaskFilter,
  searchTasks,
  type TaskFilter,
} from '@/features/tasks/taskFilter';

/** Wednesday 7 October 2026. */
const TODAY = '2026-10-07';

function task(title: string, dueOn: string | null, pickedUpBy: string | null = null): Task {
  return {
    id: title,
    title,
    description: null,
    type: 'physical',
    points: 1,
    repeatEveryDays: null,
    dueOn,
    isPrivate: false,
    forChildren: false,
    icon: null,
    assignedTo: null,
    createdBy: 'anna',
    creatorName: 'Anna',
    pickedUpBy,
    pickerName: null,
    images: [],
    lastDone: null,
    request: null,
  };
}

const tasks = [
  task('Overdue', '2026-10-01'),
  task('Today', TODAY),
  task('Picked up today', TODAY, 'ben'),
  task('In six days', '2026-10-13'),
  task('In a week', '2026-10-14'),
  task('Undated', null),
];

function shown(filter: TaskFilter) {
  return filterTasks(tasks, filter, TODAY).map(({ title }) => title);
}

describe('filterTasks', () => {
  it('shows everything with all', () => {
    expect(shown('all')).toEqual(tasks.map(({ title }) => title));
  });

  it("shows today's tasks, and overdue ones that still need doing", () => {
    expect(shown('today')).toEqual(['Overdue', 'Today', 'Picked up today']);
  });

  it('shows tasks due in the next seven days, and overdue ones', () => {
    expect(shown('week')).toEqual(['Overdue', 'Today', 'Picked up today', 'In six days']);
  });

  it('shows tasks without a due date', () => {
    expect(shown('undated')).toEqual(['Undated']);
  });

  it('shows tasks nobody has picked up', () => {
    expect(shown('available')).toEqual(['Overdue', 'Today', 'In six days', 'In a week', 'Undated']);
  });
});

describe('parseTaskFilter', () => {
  it('reads a filter from the address', () => {
    expect(parseTaskFilter('week')).toBe('week');
  });

  it('falls back to all for anything else', () => {
    expect(parseTaskFilter(null)).toBe('all');
    expect(parseTaskFilter('tomorrow')).toBe('all');
  });
});

describe('searchTasks', () => {
  const searchable = [
    task('Wash the dishes', null),
    { ...task('Book dentist', null), description: 'Call the clinic about Ella' },
    task('Pese ikkunat', null),
    task('Vacuum', null),
  ];

  function found(query: string) {
    return searchTasks(searchable, query).map(({ title }) => title);
  }

  it('shows every task without a search', () => {
    expect(found('')).toEqual(searchable.map(({ title }) => title));
    expect(found('   ')).toEqual(searchable.map(({ title }) => title));
  });

  it('finds tasks by any part of the title, ignoring case', () => {
    expect(found('DISH')).toEqual(['Wash the dishes']);
  });

  it('finds tasks by their description', () => {
    expect(found('clinic')).toEqual(['Book dentist']);
  });

  it('needs every word, in any order and across title and description', () => {
    expect(found('dishes wash')).toEqual(['Wash the dishes']);
    expect(found('dentist ella')).toEqual(['Book dentist']);
    expect(found('wash vacuum')).toEqual([]);
  });

  it('keeps ä and a apart, as Finnish does', () => {
    expect(found('IKKUNAT')).toEqual(['Pese ikkunat']);
    expect(found('ikkunät')).toEqual([]);
  });

  it('finds ä however it was typed', () => {
    const decomposed = [task('Lakaise pa\u0308a\u0308ty', null)];
    expect(searchTasks(decomposed, 'päät')).toEqual(decomposed);
  });
});
