import type { Messages } from '@/locales/en';
import { common } from '@/locales/sv/common';

const tasksCount = (count: number) => (count === 1 ? '1 uppgift' : `${String(count)} uppgifter`);

export const statistics: Messages['statistics'] = {
  eyebrow: 'Statistik',
  title: 'Rättvisa och framsteg',
  period: 'Period',
  periods: { week: 'Den här veckan', month: 'Den här månaden', all: 'Hela tiden' },
  filters: 'Filter',
  workType: 'Typ av arbete',
  compare: 'Jämför',
  compareGroup: 'Vilka som jämförs',
  memberGroups: { everyone: 'Alla', adults: 'Vuxna', children: 'Barn' },
  comparedMembers: 'Medlemmar som jämförs',
  pointsFilters: { all: 'Alla', ...common.taskTypes },
  loadFailed: 'Det gick inte att ladda statistiken. Kontrollera anslutningen och ladda om sidan.',
  inviteFamily: 'Bjud in din familj för att se hur arbetet fördelas.',
  pointsEarned: 'Intjänade poäng',
  tasksCreated: 'Skapade uppgifter',
  metrics: {
    points: {
      empty: 'Inga poäng intjänade under den här perioden än.',
    },
    physicalPoints: {
      empty: 'Inga poäng för fysiskt arbete under den här perioden än.',
    },
    metaPoints: {
      empty: 'Inga poäng för metaarbete under den här perioden än.',
    },
    created: {
      empty: 'Inga uppgifter skapade under den här perioden än.',
    },
  },
  pointsSummary: (points, done) =>
    `${common.points(points)} · ${tasksCount(done)} ${done === 1 ? 'gjord' : 'gjorda'}`,
  tasksCount,
  barParts: {
    physical: (count) => `${common.points(count)} för fysiskt arbete`,
    meta: (count) => `${common.points(count)} för metaarbete`,
  },
  byMember: (title) => `${title} per medlem`,
  fairness: 'Rättvisa',
  fairnessLabels: { balanced: 'Jämn', slightlyUneven: 'Något ojämn', uneven: 'Ojämn' },
};
