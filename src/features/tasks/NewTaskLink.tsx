import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { useMessages } from '@/lib/i18n/i18n';

export function NewTaskLink() {
  const t = useMessages();
  return (
    <Link
      to={paths.newTask}
      className="bg-brand-600 hover:bg-brand-900 shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-white"
    >
      <span aria-hidden="true">+ </span>
      {t.tasks.newTask}
    </Link>
  );
}
