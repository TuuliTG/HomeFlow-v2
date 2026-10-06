import { ComingSoon } from '@/components/ui/ComingSoon';
import { PageHeader } from '@/components/ui/PageHeader';

export function RewardsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Rewards"
        title="Rewards & goals"
        description="Personal rewards and shared family goals."
      />
      <ComingSoon>Points, personal rewards and family goals will appear here.</ComingSoon>
    </>
  );
}
