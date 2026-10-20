import { useState } from 'react';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { MetricSection } from '@/features/statistics/MetricSection';
import {
  type Comparison,
  comparedMembers,
  memberGroups,
  type Period,
  periods,
  type PointsFilter,
  pointsFilters,
  pointsMetrics,
} from '@/features/statistics/statistics';
import { StatisticsFilters } from '@/features/statistics/StatisticsFilters';
import { useContributions } from '@/features/statistics/useContributions';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';
import { useSearchParam } from '@/lib/useSearchParam';

const PERIOD_PARAM = 'period';
const POINTS_FILTER_PARAM = 'work';
const COMPARISON_PARAM = 'compare';

/**
 * The period shown, kept in the address as `?period=<period>` and remembered on this device; this week by
 * default.
 */
function usePeriodParam(userId: string) {
  return useSearchParam<Period>({
    name: PERIOD_PARAM,
    parse: (value) => periods.find((period) => period === value) ?? 'week',
    serialise: (period) => (period === 'week' ? null : period),
    rememberAs: `statistics.period:${userId}`,
  });
}

/**
 * Which tasks' points are shown, kept in the address as `?work=<filter>` and remembered on this device; all by
 * default.
 */
function usePointsFilterParam(userId: string) {
  return useSearchParam<PointsFilter>({
    name: POINTS_FILTER_PARAM,
    parse: (value) => pointsFilters.find((filter) => filter === value) ?? 'all',
    serialise: (filter) => (filter === 'all' ? null : filter),
    rememberAs: `statistics.work:${userId}`,
  });
}

/**
 * Who is compared, kept in the address as `?compare=<group>` or `?compare=<user id>,<user id>` and remembered
 * on this device; everyone by default.
 */
function useComparisonParam(userId: string) {
  return useSearchParam<Comparison>({
    name: COMPARISON_PARAM,
    parse: (value) =>
      value === null
        ? 'everyone'
        : (memberGroups.find((group) => group === value) ?? value.split(',')),
    serialise: (comparison) => {
      if (comparison === 'everyone') return null;
      return typeof comparison === 'string' ? comparison : comparison.join(',');
    },
    rememberAs: `statistics.compare:${userId}`,
  });
}

export function StatisticsPage() {
  const user = useLoggedInUser();
  const [period, setPeriod] = usePeriodParam(user.id);
  const contributions = useContributions(user.id, period);
  const t = useMessages().statistics;

  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
      <div className="mb-3">
        <SegmentedChoice
          legend={t.period}
          options={periods}
          labels={t.periods}
          value={period}
          onChange={setPeriod}
        />
      </div>
      <StatisticsBody contributions={contributions} userId={user.id} />
    </>
  );
}

function StatisticsBody({
  contributions,
  userId,
}: {
  contributions: ReturnType<typeof useContributions>;
  userId: string;
}) {
  const t = useMessages().statistics;
  const [comparison, setComparison] = useComparisonParam(userId);
  const [pointsFilter, setPointsFilter] = usePointsFilterParam(userId);
  const [filtersOpen, setFiltersOpen] = useState(false);
  if (contributions.data === undefined) {
    if (!contributions.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.loadFailed}
      </p>
    );
  }
  // With two members or fewer there is no choice to make, so an address from elsewhere can't hide anyone.
  const canCompare = contributions.data.length > 2;
  const compared = canCompare
    ? comparedMembers(contributions.data, comparison)
    : contributions.data;
  return (
    <div className="flex flex-col gap-6">
      <StatisticsFilters
        contributions={contributions.data}
        comparison={canCompare ? comparison : null}
        onComparisonChange={setComparison}
        pointsFilter={pointsFilter}
        onPointsFilterChange={setPointsFilter}
        userId={userId}
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
      />
      {contributions.data.length < 2 && (
        <p className="border-line-strong bg-surface text-ink-muted rounded-2xl border border-dashed p-4 text-sm">
          {t.inviteFamily}
        </p>
      )}
      <MetricSection
        metric={pointsMetrics[pointsFilter]}
        contributions={compared}
        userId={userId}
      />
      <MetricSection metric="created" contributions={compared} userId={userId} />
    </div>
  );
}
