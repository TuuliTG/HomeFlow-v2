import { ComingSoon } from '@/components/ui/ComingSoon';
import { PageHeader } from '@/components/ui/PageHeader';

export function MyTasksPage() {
  return (
    <>
      <PageHeader
        eyebrow="Me"
        title="My tasks"
        description="Things you've picked up and completed."
      />
      <ComingSoon>Your to-do and completed tasks will appear here.</ComingSoon>
    </>
  );
}
