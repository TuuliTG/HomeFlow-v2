import { z } from 'zod';

import { DEFAULT_POINTS, type NewTask } from '@/features/tasks/task';

const dueDate = z.iso.date();

/**
 * A new task from a link to the New task form (`/tasks/new?title=…&description=…&due=YYYY-MM-DD`), such as
 * one from another app that found the task in an email. The link is untrusted: it only fills in the form, and
 * the user chooses the rest and saves it, so the usual checks apply. Undefined without a name.
 */
export function taskFromLink(params: URLSearchParams): NewTask | undefined {
  const title = params.get('title')?.trim() ?? '';
  if (title === '') return undefined;
  const description = params.get('description')?.trim() ?? '';
  const due = dueDate.safeParse(params.get('due'));
  return {
    title,
    description: description === '' ? null : description,
    dueOn: due.success ? due.data : null,
    type: 'physical',
    points: DEFAULT_POINTS,
    repeatEveryDays: null,
    isPrivate: false,
    forChildren: false,
  };
}
