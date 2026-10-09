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
  /** Shared tasks they added in the period (meta work). */
  created: number;
}

/** How evenly the work is shared: 100 when everyone did as much, 0 when one member did it all. */
export interface Fairness {
  score: number;
  label: 'Balanced' | 'Slightly uneven' | 'Uneven';
}

/** Most done and added first; a stable sort keeps members with equal totals in the order they joined. */
export function byMostContributed(contributions: MemberContribution[]): MemberContribution[] {
  return [...contributions].sort((a, b) => b.done + b.created - (a.done + a.created));
}

/**
 * How evenly done and added tasks are spread across the members: 100 minus how far the shares are
 * from equal, as a percentage of the furthest they can be. Null with fewer than two members or
 * nothing to compare.
 */
export function fairnessOf(contributions: MemberContribution[]): Fairness | null {
  const totals = contributions.map(({ done, created }) => done + created);
  const sum = totals.reduce((total, value) => total + value, 0);
  const count = totals.length;
  if (count < 2 || sum === 0) return null;

  const evenShare = 1 / count;
  const distance =
    totals.reduce((total, value) => total + Math.abs(value / sum - evenShare), 0) / 2;
  const score = Math.round(100 * (1 - distance / (1 - evenShare)));
  const label = score >= 80 ? 'Balanced' : score >= 50 ? 'Slightly uneven' : 'Uneven';
  return { score, label };
}
