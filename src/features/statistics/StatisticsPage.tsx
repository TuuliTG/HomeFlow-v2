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

/** The period shown, kept in the address as `?period=<period>`; this week by default. */
function usePeriodParam() {
  return useSearchParam<Period>(
    PERIOD_PARAM,
    (value) => periods.find((period) => period === value) ?? 'week',
    (period) => (period === 'week' ? null : period),
  );
}

/** Which tasks' points are shown, kept in the address as `?work=<filter>`; all by default. */
function usePointsFilterParam() {
  return useSearchParam<PointsFilter>(
    POINTS_FILTER_PARAM,
    (value) => pointsFilters.find((filter) => filter === value) ?? 'all',
    (filter) => (filter === 'all' ? null : filter),
  );
}

/**
 * Who is compared, kept in the address as `?compare=<group>` or `?compare=<user id>,<user id>`;
 * everyone by default.
 */
function useComparisonParam() {
  return useSearchParam<Comparison>(
    COMPARISON_PARAM,
    (value) =>
      value === null
        ? 'everyone'
        : (memberGroups.find((group) => group === value) ?? value.split(',')),
    (comparison) => {
      if (comparison === 'everyone') return null;
      return typeof comparison === 'string' ? comparison : comparison.join(',');
    },
  );
}

export function StatisticsPage() {
  const user = useLoggedInUser();
  const [period, setPeriod] = usePeriodParam();
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
  const [comparison, setComparison] = useComparisonParam();
  const [pointsFilter, setPointsFilter] = usePointsFilterParam();
  const [filtersOpen, setFiltersOpen] = useState(false);
  if (contributions.data === undefined) {
    if (!contributions.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-sm text-red-700">
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
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
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
