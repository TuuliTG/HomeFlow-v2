import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { MetricSection } from '@/features/statistics/MetricSection';
import {
  type MemberContribution,
  type Period,
  periods,
  type PointsFilter,
  pointsFilters,
  pointsMetrics,
} from '@/features/statistics/statistics';
import { useContributions } from '@/features/statistics/useContributions';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';
import { useSearchParam } from '@/lib/useSearchParam';

const PERIOD_PARAM = 'period';
const POINTS_FILTER_PARAM = 'work';

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

export function StatisticsPage() {
  const user = useLoggedInUser();
  const [period, setPeriod] = usePeriodParam();
  const contributions = useContributions(user.id, period);
  const t = useMessages().statistics;

  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
      <div className="mb-6">
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

/** Points earned, from all tasks or one task type at a time. */
function PointsSection({
  contributions,
  userId,
}: {
  contributions: MemberContribution[];
  userId: string;
}) {
  const [filter, setFilter] = usePointsFilterParam();
  const t = useMessages().statistics;
  return (
    <MetricSection metric={pointsMetrics[filter]} contributions={contributions} userId={userId}>
      <SegmentedChoice
        legend={t.workType}
        options={pointsFilters}
        labels={t.pointsFilters}
        value={filter}
        onChange={setFilter}
      />
    </MetricSection>
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
  if (contributions.data === undefined) {
    if (!contributions.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-sm text-red-700">
        {t.loadFailed}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {contributions.data.length < 2 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          {t.inviteFamily}
        </p>
      )}
      <PointsSection contributions={contributions.data} userId={userId} />
      <MetricSection metric="created" contributions={contributions.data} userId={userId} />
    </div>
  );
}
