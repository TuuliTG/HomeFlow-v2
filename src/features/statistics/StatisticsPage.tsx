import { useSearchParams } from 'react-router';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  byMostContributed,
  fairnessOf,
  type MemberContribution,
  type Period,
  periodLabels,
  periods,
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
        description="How shared tasks are done and added across the family. Private tasks don't count."
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
      <FairnessScore contributions={contributions.data} />
      <Leaderboard contributions={byMostContributed(contributions.data)} userId={userId} />
    </div>
  );
}

function FairnessScore({ contributions }: { contributions: MemberContribution[] }) {
  const fairness = fairnessOf(contributions);
  return (
    <section
      aria-labelledby="fairness-heading"
      className="rounded-2xl border border-slate-200 bg-white p-4"
    >
      <h2 id="fairness-heading" className="text-sm font-medium text-slate-600">
        Fairness score
      </h2>
      {fairness ? (
        <>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-slate-900">{fairness.score}</span>
            <span className="text-sm text-slate-500">/ 100</span>
            <span className="bg-brand-50 text-brand-900 ml-auto rounded-full px-3 py-1 text-sm font-semibold">
              {fairness.label}
            </span>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            100 means everyone did and added as many tasks as each other.
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-600">
          {contributions.length < 2
            ? 'Invite your family to see how the work is shared.'
            : 'Nothing done or added yet in this period.'}
        </p>
      )}
    </section>
  );
}

function Leaderboard({
  contributions,
  userId,
}: {
  contributions: MemberContribution[];
  userId: string;
}) {
  const most = Math.max(1, ...contributions.map(({ done, created }) => done + created));
  return (
    <section aria-labelledby="leaderboard-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="leaderboard-heading" className="text-lg font-semibold text-slate-900">
          Leaderboard
        </h2>
        <p aria-hidden="true" className="flex gap-3 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <span className="bg-brand-600 size-2.5 rounded-full" /> Done
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-meta-500 size-2.5 rounded-full" /> Added
          </span>
        </p>
      </div>
      <ol className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        {contributions.map((member) => (
          <li
            key={member.userId}
            aria-label={memberName(member, userId)}
            className="flex flex-col gap-2 px-4 py-3 text-sm"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium text-slate-900">{memberName(member, userId)}</span>
              <span className="text-slate-600">
                {member.done} done · {member.created} added
              </span>
            </div>
            <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="bg-brand-600"
                style={{ width: `${String((member.done / most) * 100)}%` }}
              />
              <div
                className="bg-meta-500"
                style={{ width: `${String((member.created / most) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function memberName({ userId, displayName }: MemberContribution, currentUserId: string): string {
  if (userId === currentUserId) return 'You';
  return displayName ?? 'New member (no name yet)';
}
