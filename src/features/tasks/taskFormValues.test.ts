import { describe, expect, it } from 'vitest';

import { checkTask, fieldValues } from '@/features/tasks/taskFormValues';
import { repeatFieldValue } from '@/features/tasks/taskRepeat';
import { en } from '@/locales/en';

describe('checkTask', () => {
  const repeating = {
    ...fieldValues(),
    title: 'Empty the dishwasher',
    repeat: repeatFieldValue(1),
    dueOn: '2026-10-08',
  };

  it('gives a routine no repeat or due date, as it is always available', () => {
    const parsed = checkTask({ ...repeating, isRoutine: true }, false, en);

    expect(parsed).toMatchObject({
      success: true,
      data: { isRoutine: true, repeatEveryDays: null, dueOn: null },
    });
  });

  it('keeps the repeat and due date of a private task, which is no routine', () => {
    const parsed = checkTask({ ...repeating, isRoutine: true, isPrivate: true }, false, en);

    expect(parsed).toMatchObject({
      success: true,
      data: { isRoutine: false, repeatEveryDays: 1, dueOn: '2026-10-08' },
    });
  });

  it("keeps a task a priority only while it is an adults' shared task that is no routine", () => {
    const priority = { ...repeating, isPriority: true };

    expect(checkTask(priority, false, en)).toMatchObject({ data: { isPriority: true } });
    expect(checkTask({ ...priority, isPrivate: true }, false, en)).toMatchObject({
      data: { isPriority: false },
    });
    expect(checkTask({ ...priority, forChildren: true }, false, en)).toMatchObject({
      data: { isPriority: false },
    });
    expect(checkTask({ ...priority, isRoutine: true }, false, en)).toMatchObject({
      data: { isPriority: false },
    });
  });
});
