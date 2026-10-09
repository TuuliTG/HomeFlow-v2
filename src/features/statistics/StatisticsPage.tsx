import { useSearchParams } from 'react-router';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  fairnessOf,
  type MemberContribution,
  type Metric,
  type Period,
  periodLabels,
  periods,
  rankBy,
} from '@/features/statistics/statistics';
import { useContributions } from '@/features/statistics/useContributions';
import { useLoggedInUser } from '@/lib/auth';

const PERIOD_PARAM = 'period';

function isPeriod(value: string | null): value is Period {
  return periods.some((period) => period === value);
}

export function StatisticsPage() {
  const user = useLoggedInUser();
  // Kept in the address, so the choice survives a reload.
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get(PERIOD_PARAM);
  const period: Period = isPeriod(param) ? param : 'week';
  const contributions = useContributions(user.id, period);

  return (
    <>
      <PageHeader
        eyebrow="Statistics"
        title="Fairness & progress"
        description="Points earned and tasks created across the family. Private tasks don't count."
      />
      <PeriodPicker
        period={period}
        onChange={(next) => {
          setSearchParams(next === 'week' ? {} : { [PERIOD_PARAM]: next }, { replace: true });
        }}
      />
      <StatisticsBody contributions={contributions} userId={user.id} />
    </>
  );
}

function PeriodPicker({
  period,
  onChange,
}: {
  period: Period;
  onChange: (period: Period) => void;
}) {
  return (
    <fieldset className="mb-6">
      <legend className="sr-only">Period</legend>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200 p-1 text-sm font-medium">
        {periods.map((option) => (
          <label
            key={option}
            className="has-checked:text-brand-900 has-focus-visible:outline-brand-600 flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-slate-600 has-checked:bg-white has-checked:shadow-sm has-focus-visible:outline-2"
          >
            <input
              type="radio"
              name="period"
              value={option}
              checked={option === period}
              onChange={() => {
                onChange(option);
              }}
              className="sr-only"
            />
            {periodLabels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function StatisticsBody({
  contributions,
  userId,
}: {
  contributions: ReturnType<typeof useContributions>;
  userId: string;
}) {
  if (contributions.data === undefined) {
    if (!contributions.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-sm text-red-700">
        We couldn&apos;t load the statistics. Check your connection and reload the page.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {contributions.data.length < 2 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          Invite your family to see how the work is shared.
        </p>
      )}
      {metrics.map((metric) => (
        <MetricSection
          key={metric}
          metric={metric}
          contributions={contributions.data}
          userId={userId}
        />
      ))}
    </div>
  );
}

interface MetricDetails {
  title: string;
  description: string;
  /** "12 points · 3 tasks done" */
  summary: (member: MemberContribution) => string;
  /** Shown instead of a fairness score while no one has any. */
  empty: string;
  barClassName: string;
}

const metrics: Metric[] = ['points', 'created'];

const metricDetails: Record<Metric, MetricDetails> = {
  points: {
    title: 'Points earned',
    description: 'From doing shared tasks.',
    summary: ({ points, done }) => `${countOf(points, 'point')} · ${countOf(done, 'task')} done`,
    empty: 'No points earned yet in this period.',
    barClassName: 'bg-brand-600',
  },
  created: {
    title: 'Tasks created',
    description: 'Adding shared tasks is meta work: planning and remembering.',
    summary: ({ created }) => countOf(created, 'task'),
    empty: 'No tasks created yet in this period.',
    barClassName: 'bg-meta-500',
  },
};

/** "1 point", "3 points". */
function countOf(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}

/** One metric: its fairness score and each member's share, most first. */
function MetricSection({
  metric,
  contributions,
  userId,
}: {
  metric: Metric;
  contributions: MemberContribution[];
  userId: string;
}) {
  const { title, description, summary, empty, barClassName } = metricDetails[metric];
  const headingId = `${metric}-heading`;
  const most = Math.max(1, ...contributions.map((member) => member[metric]));
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div>
        <h2 id={headingId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      <div className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        <FairnessScore contributions={contributions} metric={metric} empty={empty} />
        <ol aria-label={`${title} by member`} className="flex flex-col divide-y divide-slate-200">
          {rankBy(contributions, metric).map((member) => (
            <li
              key={member.userId}
              aria-label={memberName(member, userId)}
              className="flex flex-col gap-2 px-4 py-3 text-sm"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium text-slate-900">{memberName(member, userId)}</span>
                <span className="text-slate-600">{summary(member)}</span>
              </div>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full ${barClassName}`}
                  style={{ width: `${String((member[metric] / most) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FairnessScore({
  contributions,
  metric,
  empty,
}: {
  contributions: MemberContribution[];
  metric: Metric;
  empty: string;
}) {
  if (contributions.length < 2) return null;
  const fairness = fairnessOf(contributions, metric);
  if (!fairness) return <p className="px-4 py-3 text-sm text-slate-600">{empty}</p>;
  return (
    <p className="flex items-center gap-2 px-4 py-3 text-sm text-slate-600">
      Fairness
      <span className="text-lg font-bold text-slate-900">{fairness.score}</span>/ 100
      <span className="bg-brand-50 text-brand-900 ml-auto rounded-full px-3 py-1 font-semibold">
        {fairness.label}
      </span>
    </p>
  );
}

function memberName({ userId, displayName }: MemberContribution, currentUserId: string): string {
  if (userId === currentUserId) return 'You';
  return displayName ?? 'New member (no name yet)';
}
