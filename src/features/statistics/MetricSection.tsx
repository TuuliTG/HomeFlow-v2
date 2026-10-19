import {
  fairnessOf,
  type MemberContribution,
  memberName,
  type Metric,
  rankBy,
} from '@/features/statistics/statistics';
import { type Messages, useMessages } from '@/lib/i18n/i18n';

type WorkType = 'physical' | 'meta';

interface MetricDetails {
  title: string;
  description: string;
  /** "12 points · 3 tasks done" */
  summary: (member: MemberContribution) => string;
  /** Shown instead of a fairness score while no one has any. */
  empty: string;
  /** Each member's bar: one colour per kind of work, with how much of the bar it fills. */
  bar: (member: MemberContribution) => BarSegment[];
  /** What the colours of a split bar mean. */
  legend?: { label: string; className: string }[];
}

interface BarSegment {
  kind: WorkType;
  value: number;
  className: string;
}

const PHYSICAL_BAR = 'bg-brand-600';
const META_BAR = 'bg-meta-500';

function metricDetails(metric: Metric, t: Messages): MetricDetails {
  const { pointsSummary } = t.statistics;
  const { description, empty } = t.statistics.metrics[metric];
  const pointsTitle = t.statistics.pointsEarned;
  switch (metric) {
    case 'points':
      return {
        title: pointsTitle,
        description,
        empty,
        summary: ({ points, done }) => pointsSummary(points, done),
        bar: ({ physicalPoints, metaPoints }) => [
          { kind: 'physical', value: physicalPoints, className: PHYSICAL_BAR },
          { kind: 'meta', value: metaPoints, className: META_BAR },
        ],
        legend: [
          { label: t.common.taskTypes.physical, className: PHYSICAL_BAR },
          { label: t.common.taskTypes.meta, className: META_BAR },
        ],
      };
    case 'physicalPoints':
      return {
        title: pointsTitle,
        description,
        empty,
        summary: ({ physicalPoints, physicalDone }) => pointsSummary(physicalPoints, physicalDone),
        bar: ({ physicalPoints }) => [
          { kind: 'physical', value: physicalPoints, className: PHYSICAL_BAR },
        ],
      };
    case 'metaPoints':
      return {
        title: pointsTitle,
        description,
        empty,
        summary: ({ metaPoints, metaDone }) => pointsSummary(metaPoints, metaDone),
        bar: ({ metaPoints }) => [{ kind: 'meta', value: metaPoints, className: META_BAR }],
      };
    case 'created':
      return {
        title: t.statistics.tasksCreated,
        description,
        empty,
        summary: ({ created }) => t.statistics.tasksCount(created),
        bar: ({ created }) => [{ kind: 'meta', value: created, className: META_BAR }],
      };
  }
}

/** One metric: its fairness score and each member's share, most first. */
export function MetricSection({
  metric,
  contributions,
  userId,
}: {
  metric: Metric;
  contributions: MemberContribution[];
  userId: string;
}) {
  const t = useMessages();
  const { title, description, summary, empty, bar, legend } = metricDetails(metric, t);
  const headingId = `${metric}-heading`;
  const most = Math.max(1, ...contributions.map((member) => member[metric]));
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div>
        <h2 id={headingId} className="text-ink text-lg font-semibold">
          {title}
        </h2>
        <p className="text-ink-muted text-sm">{description}</p>
      </div>
      <div className="divide-line bg-surface shadow-card flex flex-col divide-y rounded-2xl">
        <FairnessScore contributions={contributions} metric={metric} empty={empty} />
        {legend && <Legend entries={legend} />}
        <ol
          aria-label={t.statistics.byMember(title)}
          className="divide-line flex flex-col divide-y"
        >
          {rankBy(contributions, metric).map((member) => (
            <li
              key={member.userId}
              aria-label={memberName(member, userId, t)}
              className="flex flex-col gap-2 px-4 py-3 text-sm"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-ink font-medium">{memberName(member, userId, t)}</span>
                <span className="text-ink-muted">{summary(member)}</span>
              </div>
              <Bar segments={bar(member)} most={most} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** A member's share against whoever has most; a split bar says what each colour is worth. */
function Bar({ segments, most }: { segments: BarSegment[]; most: number }) {
  const t = useMessages();
  const split = segments.length > 1;
  return (
    <div
      role={split ? 'img' : undefined}
      aria-label={
        split
          ? segments.map(({ kind, value }) => t.statistics.barParts[kind](value)).join(', ')
          : undefined
      }
      aria-hidden={split ? undefined : true}
      className="bg-page flex h-2 overflow-hidden rounded-full"
    >
      {segments.map(({ kind, value, className }) => (
        <div
          key={kind}
          className={`h-full ${className}`}
          style={{ width: `${String((value / most) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/** The bars' colours; each split bar also names its parts for screen readers. */
function Legend({ entries }: { entries: { label: string; className: string }[] }) {
  return (
    <p aria-hidden="true" className="text-ink-muted flex gap-4 px-4 py-2 text-xs">
      {entries.map(({ label, className }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-full ${className}`} />
          {label}
        </span>
      ))}
    </p>
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
  const t = useMessages().statistics;
  if (contributions.length < 2) return null;
  const fairness = fairnessOf(contributions, metric);
  if (!fairness) return <p className="text-ink-muted px-4 py-3 text-sm">{empty}</p>;
  return (
    <p className="text-ink-muted flex items-center gap-2 px-4 py-3 text-sm">
      {t.fairness}
      <span className="text-ink text-lg font-bold">{fairness.score}</span>/ 100
      <span className="bg-brand-50 text-brand-900 ml-auto rounded-full px-3 py-1 font-semibold">
        {t.fairnessLabels[fairness.label]}
      </span>
    </p>
  );
}
