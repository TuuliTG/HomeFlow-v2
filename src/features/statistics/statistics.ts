/** The periods the Statistics screen can show, from the start of each until now. */
export const periods = ['week', 'month', 'all'] as const;

export type Period = (typeof periods)[number];

export const periodLabels: Record<Period, string> = {
  week: 'This week',
  month: 'This month',
  all: 'All time',
};

/** When `period` started on the user's local calendar (weeks start on Monday); null for all time. */
export function periodStart(period: Period, now: Date): Date | null {
  switch (period) {
    case 'week': {
      const daysSinceMonday = (now.getDay() + 6) % 7;
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'all':
      return null;
  }
}

export interface MemberContribution {
  userId: string;
  /** Null while the member has no profile, i.e. hasn't chosen a display name yet. */
  displayName: string | null;
  /** Shared tasks they marked done in the period. */
  done: number;
  /** Points those tasks earned. */
  points: number;
  /** The physical tasks among those, and their points. */
  physicalDone: number;
  physicalPoints: number;
  /** The meta work tasks among those, and their points. */
  metaDone: number;
  metaPoints: number;
  /** Shared tasks they added in the period (meta work). */
  created: number;
}

/** What the Statistics screen compares members by, each on its own. */
export type Metric = 'points' | 'physicalPoints' | 'metaPoints' | 'created';

/** Which tasks' points the Points earned graph counts: all of them, or one task type. */
export const pointsFilters = ['all', 'physical', 'meta'] as const;

export type PointsFilter = (typeof pointsFilters)[number];

export const pointsFilterLabels: Record<PointsFilter, string> = {
  all: 'All',
  physical: 'Physical',
  meta: 'Meta work',
};

export const pointsMetrics: Record<PointsFilter, Metric> = {
  all: 'points',
  physical: 'physicalPoints',
  meta: 'metaPoints',
};

/** How evenly a metric is shared: 100 when everyone has as much, 0 when one member has it all. */
export interface Fairness {
  score: number;
  label: 'Balanced' | 'Slightly uneven' | 'Uneven';
}

/** Most first; a stable sort keeps members with equal values in the order they joined. */
export function rankBy(contributions: MemberContribution[], metric: Metric): MemberContribution[] {
  return [...contributions].sort((a, b) => b[metric] - a[metric]);
}

/**
 * How evenly `metric` is spread across the members: 100 minus how far the shares are from equal, as
 * a percentage of the furthest they can be. Null with fewer than two members or nothing to compare.
 */
export function fairnessOf(contributions: MemberContribution[], metric: Metric): Fairness | null {
  const values = contributions.map((contribution) => contribution[metric]);
  const sum = values.reduce((total, value) => total + value, 0);
  const count = values.length;
  if (count < 2 || sum === 0) return null;

  const evenShare = 1 / count;
  const distance =
    values.reduce((total, value) => total + Math.abs(value / sum - evenShare), 0) / 2;
  const score = Math.round(100 * (1 - distance / (1 - evenShare)));
  const label = score >= 80 ? 'Balanced' : score >= 50 ? 'Slightly uneven' : 'Uneven';
  return { score, label };
}
