import { useQuery } from '@tanstack/react-query';

import { fetchContributions } from '@/features/statistics/api';
import { type Period, periodStart } from '@/features/statistics/statistics';

/** What each member of the household has done and added in `period`, up to now. */
export function useContributions(userId: string, period: Period) {
  return useQuery({
    queryKey: ['statistics', userId, period],
    queryFn: () => fetchContributions(periodStart(period, new Date())),
  });
}
