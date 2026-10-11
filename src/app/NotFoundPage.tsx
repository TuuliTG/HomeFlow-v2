import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { useMessages } from '@/lib/i18n/i18n';

export function NotFoundPage() {
  const t = useMessages().app.notFound;
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <Link to={paths.tasks} className="text-brand-600 font-medium underline">
        {t.backToTasks}
      </Link>
    </>
  );
}
