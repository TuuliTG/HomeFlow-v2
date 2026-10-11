import type { Messages } from '@/lib/i18n/i18n';

/** The periods the Statistics screen can show, from the start of each until now. */
export const periods = ['week', 'month', 'all'] as const;

export type Period = (typeof periods)[number];

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
  isChild: boolean;
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

/** The groups of members the Statistics screen can compare at once. */
export const memberGroups = ['everyone', 'adults', 'children'] as const;

export type MemberGroup = (typeof memberGroups)[number];

/** Who the Statistics screen compares: a group of members, or members chosen one by one by user id. */
export type Comparison = MemberGroup | readonly string[];

function membersOf(
  contributions: MemberContribution[],
  comparison: Comparison,
): MemberContribution[] {
  switch (comparison) {
    case 'everyone':
      return contributions;
    case 'adults':
      return contributions.filter((member) => !member.isChild);
    case 'children':
      return contributions.filter((member) => member.isChild);
    default:
      return contributions.filter((member) => comparison.includes(member.userId));
  }
}

/**
 * The members compared, in the order they joined; everyone when no one matches (e.g. children in a
 * family without any, or members who have left).
 */
export function comparedMembers(
  contributions: MemberContribution[],
  comparison: Comparison,
): MemberContribution[] {
  const members = membersOf(contributions, comparison);
  return members.length > 0 ? members : contributions;
}

/** The group that is exactly these members, if there is one. */
export function groupOf(
  contributions: MemberContribution[],
  members: MemberContribution[],
): MemberGroup | null {
  return (
    memberGroups.find((group) => {
      const inGroup = membersOf(contributions, group);
      return (
        inGroup.length === members.length && inGroup.every((member) => members.includes(member))
      );
    }) ?? null
  );
}

/** How to compare these members: as a group when they make one, otherwise one by one. */
export function comparisonOf(
  contributions: MemberContribution[],
  members: MemberContribution[],
): Comparison {
  return groupOf(contributions, members) ?? members.map((member) => member.userId);
}

/** Whether the family has both adults and children, so comparing either group on its own means something. */
export function hasMemberGroups(contributions: MemberContribution[]): boolean {
  return (
    contributions.some((member) => member.isChild) &&
    contributions.some((member) => !member.isChild)
  );
}

/** What the Statistics screen compares members by, each on its own. */
export type Metric = 'points' | 'physicalPoints' | 'metaPoints' | 'created';

/** Which tasks' points the Points earned graph counts: all of them, or one task type. */
export const pointsFilters = ['all', 'physical', 'meta'] as const;

export type PointsFilter = (typeof pointsFilters)[number];

export const pointsMetrics: Record<PointsFilter, Metric> = {
  all: 'points',
  physical: 'physicalPoints',
  meta: 'metaPoints',
};

/** How evenly a metric is shared: 100 when everyone has as much, 0 when one member has it all. */
export interface Fairness {
  score: number;
  label: 'balanced' | 'slightlyUneven' | 'uneven';
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
  const label = score >= 80 ? 'balanced' : score >= 50 ? 'slightlyUneven' : 'uneven';
  return { score, label };
}

/** "You" for the logged-in user, otherwise the member's display name. */
export function memberName(
  { userId, displayName }: MemberContribution,
  currentUserId: string,
  t: Messages,
): string {
  if (userId === currentUserId) return t.common.you;
  return displayName ?? t.common.newMember;
}
