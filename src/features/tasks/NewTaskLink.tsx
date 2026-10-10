import { Link } from 'react-router';

import { paths } from '@/app/paths';

export function NewTaskLink() {
  return (
    <Link
      to={paths.newTask}
      className="bg-brand-600 hover:bg-brand-900 shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-white"
    >
      <span aria-hidden="true">+ </span>New task
    </Link>
  );
}
