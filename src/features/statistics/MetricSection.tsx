import type { ReactNode } from 'react';

import {
  fairnessOf,
  type MemberContribution,
  type Metric,
  rankBy,
} from '@/features/statistics/statistics';

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
  label: string;
  value: number;
  className: string;
}

const PHYSICAL_BAR = 'bg-brand-600';
const META_BAR = 'bg-meta-500';

const metricDetails: Record<Metric, MetricDetails> = {
  points: {
    title: 'Points earned',
    description: 'From doing shared tasks, physical and meta work.',
    summary: ({ points, done }) => pointsSummary(points, done),
    empty: 'No points earned yet in this period.',
    bar: ({ physicalPoints, metaPoints }) => [
      { label: 'physical', value: physicalPoints, className: PHYSICAL_BAR },
      { label: 'meta work', value: metaPoints, className: META_BAR },
    ],
    legend: [
      { label: 'Physical', className: PHYSICAL_BAR },
      { label: 'Meta work', className: META_BAR },
    ],
  },
  physicalPoints: {
    title: 'Points earned',
    description: 'From doing physical tasks: cleaning, cooking, fixing.',
    summary: ({ physicalPoints, physicalDone }) => pointsSummary(physicalPoints, physicalDone),
    empty: 'No physical work points yet in this period.',
    bar: ({ physicalPoints }) => [
      { label: 'physical', value: physicalPoints, className: PHYSICAL_BAR },
    ],
  },
  metaPoints: {
    title: 'Points earned',
    description: 'From doing meta work tasks: planning, booking, remembering.',
    summary: ({ metaPoints, metaDone }) => pointsSummary(metaPoints, metaDone),
    empty: 'No meta work points yet in this period.',
    bar: ({ metaPoints }) => [{ label: 'meta work', value: metaPoints, className: META_BAR }],
  },
  created: {
    title: 'Tasks created',
    description: 'Adding shared tasks is meta work: planning and remembering.',
    summary: ({ created }) => countOf(created, 'task'),
    empty: 'No tasks created yet in this period.',
    bar: ({ created }) => [{ label: 'tasks', value: created, className: META_BAR }],
  },
};

/** "12 points · 3 tasks done" */
function pointsSummary(points: number, done: number): string {
  return `${countOf(points, 'point')} · ${countOf(done, 'task')} done`;
}

/** "1 point", "3 points". */
function countOf(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}

/** One metric: its fairness score and each member's share, most first; `children` go above them. */
export function MetricSection({
  metric,
  contributions,
  userId,
  children,
}: {
  metric: Metric;
  contributions: MemberContribution[];
  userId: string;
  children?: ReactNode;
}) {
  const { title, description, summary, empty, bar, legend } = metricDetails[metric];
  const headingId = `${title.toLowerCase().replaceAll(' ', '-')}-heading`;
  const most = Math.max(1, ...contributions.map((member) => member[metric]));
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div>
        <h2 id={headingId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      {children}
      <div className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        <FairnessScore contributions={contributions} metric={metric} empty={empty} />
        {legend && <Legend entries={legend} />}
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
  const split = segments.length > 1;
  return (
    <div
      role={split ? 'img' : undefined}
      aria-label={
        split
          ? segments.map(({ label, value }) => countOf(value, `${label} point`)).join(', ')
          : undefined
      }
      aria-hidden={split ? undefined : true}
      className="flex h-2 overflow-hidden rounded-full bg-slate-100"
    >
      {segments.map(({ label, value, className }) => (
        <div
          key={label}
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
    <p aria-hidden="true" className="flex gap-4 px-4 py-2 text-xs text-slate-600">
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
