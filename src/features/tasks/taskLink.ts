import { z } from 'zod';

import {
  DESCRIPTION_MAX_LENGTH,
  NEW_TASK_DEFAULTS,
  type NewTask,
  TITLE_MAX_LENGTH,
} from '@/features/tasks/task';

const dueDate = z.iso.date();

/**
 * A new task from a link to the New task form (`/tasks/new?title=…&description=…&due=YYYY-MM-DD`), such as
 * one from another app that found the task in an email. The link is untrusted: it only fills in the form, and
 * the user chooses the rest and saves it, so the usual checks apply. Text too long to save is shortened, so the
 * user needn't trim it on a phone. Undefined without a name.
 */
export function taskFromLink(params: URLSearchParams): NewTask | undefined {
  const title = linkText(params, 'title', TITLE_MAX_LENGTH);
  if (title === '') return undefined;
  const description = linkText(params, 'description', DESCRIPTION_MAX_LENGTH);
  const due = dueDate.safeParse(params.get('due'));
  return {
    title,
    description: description === '' ? null : description,
    dueOn: due.success ? due.data : null,
    ...NEW_TASK_DEFAULTS,
  };
}

function linkText(params: URLSearchParams, name: string, maxLength: number): string {
  return (params.get(name) ?? '').trim().slice(0, maxLength).trimEnd();
}
