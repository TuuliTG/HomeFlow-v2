import { describe, expect, it } from 'vitest';

import { DEFAULT_POINTS } from '@/features/tasks/task';
import { taskFromLink } from '@/features/tasks/taskLink';

function linked(query: string) {
  return taskFromLink(new URLSearchParams(query));
}

describe('taskFromLink', () => {
  it('reads the name, description and due date, with a new task’s defaults for the rest', () => {
    expect(
      linked('title=Bring+permission+slip&description=From+the+school&due=2026-10-20'),
    ).toEqual({
      title: 'Bring permission slip',
      description: 'From the school',
      dueOn: '2026-10-20',
      type: 'physical',
      points: DEFAULT_POINTS,
      repeatEveryDays: null,
      isPrivate: false,
      forChildren: false,
    });
  });

  it('is undefined without a name', () => {
    expect(linked('')).toBeUndefined();
    expect(linked('title=++&description=Something')).toBeUndefined();
  });

  it('leaves out an empty description and a due date that isn’t a date', () => {
    expect(linked('title=Pay+trip&description=+&due=next+Friday')).toMatchObject({
      title: 'Pay trip',
      description: null,
      dueOn: null,
    });
  });
});
