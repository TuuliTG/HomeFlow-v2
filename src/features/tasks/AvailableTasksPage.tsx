import { ComingSoon } from '@/components/ui/ComingSoon';
import { PageHeader } from '@/components/ui/PageHeader';

export function AvailableTasksPage() {
  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="Available tasks"
        description="Pick any task. New tasks earn bonus points for variety and fairness."
      />
      <ComingSoon>The shared task board will appear here.</ComingSoon>
    </>
  );
}
