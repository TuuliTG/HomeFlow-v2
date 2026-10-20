import { common } from '@/locales/en/common';

/** "1 task", "3 tasks". */
const tasksCount = (count: number) => (count === 1 ? '1 task' : `${String(count)} tasks`);

/** The Statistics tab: fairness and each member's share. */
export const statistics = {
  eyebrow: 'Statistics',
  title: 'Fairness & progress',
  period: 'Period',
  periods: { week: 'This week', month: 'This month', all: 'All time' },
  filters: 'Filters',
  workType: 'Work type',
  compare: 'Compare',
  compareGroup: 'Who to compare',
  memberGroups: { everyone: 'Everyone', adults: 'Adults', children: 'Children' },
  comparedMembers: 'Members compared',
  pointsFilters: { all: 'All', ...common.taskTypes },
  loadFailed: "We couldn't load the statistics. Check your connection and reload the page.",
  inviteFamily: 'Invite your family to see how the work is shared.',
  pointsEarned: 'Points earned',
  tasksCreated: 'Tasks created',
  metrics: {
    points: {
      empty: 'No points earned yet in this period.',
    },
    physicalPoints: {
      empty: 'No physical work points yet in this period.',
    },
    metaPoints: {
      empty: 'No meta work points yet in this period.',
    },
    created: {
      empty: 'No tasks created yet in this period.',
    },
  },
  /** "12 points · 3 tasks done". */
  pointsSummary: (points: number, done: number) =>
    `${common.points(points)} · ${tasksCount(done)} done`,
  tasksCount,
  /** What a part of a member's bar is worth, for screen readers. */
  barParts: {
    physical: (count: number) =>
      count === 1 ? '1 physical point' : `${String(count)} physical points`,
    meta: (count: number) =>
      count === 1 ? '1 meta work point' : `${String(count)} meta work points`,
  },
  byMember: (title: string) => `${title} by member`,
  fairness: 'Fairness',
  fairnessLabels: { balanced: 'Balanced', slightlyUneven: 'Slightly uneven', uneven: 'Uneven' },
};
