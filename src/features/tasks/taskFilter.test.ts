import { describe, expect, it } from 'vitest';

import type { Task } from '@/features/tasks/task';
import { filterTasks, parseTaskFilter, type TaskFilter } from '@/features/tasks/taskFilter';

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
    createdBy: 'anna',
    creatorName: 'Anna',
    pickedUpBy,
    pickerName: null,
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
    expect(shown('available')).not.toContain('Picked up today');
    expect(shown('available')).toHaveLength(tasks.length - 1);
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
