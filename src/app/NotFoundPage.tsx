import { Link } from 'react-router';

import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" description="This page doesn't exist." />
      <Link to={paths.tasks} className="text-brand-600 font-medium underline">
        Back to tasks
      </Link>
    </>
  );
}
