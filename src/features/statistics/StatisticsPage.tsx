import { ComingSoon } from '@/components/ui/ComingSoon';
import { PageHeader } from '@/components/ui/PageHeader';

export function StatisticsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Statistics"
        title="Fairness & progress"
        description="How contributions balance out over time."
      />
      <ComingSoon>The fairness score and leaderboard will appear here.</ComingSoon>
    </>
  );
}
