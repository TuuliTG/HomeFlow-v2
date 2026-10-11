import type { Messages } from '@/locales/en';
import { common } from '@/locales/fi/common';

const tasksCount = (count: number) => (count === 1 ? '1 tehtävä' : `${String(count)} tehtävää`);

export const statistics: Messages['statistics'] = {
  eyebrow: 'Tilastot',
  title: 'Reiluus ja edistyminen',
  description:
    'Koko perheen ansaitsemat pisteet ja luomat tehtävät. Yksityisiä tehtäviä ei lasketa.',
  period: 'Ajanjakso',
  periods: { week: 'Tämä viikko', month: 'Tämä kuukausi', all: 'Koko ajalta' },
  workType: 'Työn tyyppi',
  compare: 'Vertaa',
  compareGroup: 'Keitä verrataan',
  memberGroups: { everyone: 'Kaikki', adults: 'Aikuiset', children: 'Lapset' },
  comparedMembers: 'Verrattavat jäsenet',
  pointsFilters: { all: 'Kaikki', ...common.taskTypes },
  loadFailed: 'Tilastoja ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
  inviteFamily: 'Kutsu perheesi, niin näet, miten työt jakautuvat.',
  pointsEarned: 'Ansaitut pisteet',
  tasksCreated: 'Luodut tehtävät',
  metrics: {
    points: {
      description: 'Yhteisistä tehtävistä, sekä fyysisestä työstä että metatyöstä.',
      empty: 'Tällä ajanjaksolla ei ole vielä ansaittu pisteitä.',
    },
    physicalPoints: {
      description: 'Fyysisistä tehtävistä: siivoamisesta, ruoanlaitosta, korjaamisesta.',
      empty: 'Tällä ajanjaksolla ei ole vielä pisteitä fyysisestä työstä.',
    },
    metaPoints: {
      description: 'Metatyön tehtävistä: suunnittelusta, varaamisesta, muistamisesta.',
      empty: 'Tällä ajanjaksolla ei ole vielä pisteitä metatyöstä.',
    },
    created: {
      description: 'Yhteisten tehtävien lisääminen on metatyötä: suunnittelua ja muistamista.',
      empty: 'Tällä ajanjaksolla ei ole vielä luotu tehtäviä.',
    },
  },
  pointsSummary: (points, done) => `${common.points(points)} · ${tasksCount(done)} tehty`,
  tasksCount,
  barParts: {
    physical: (count) =>
      count === 1 ? '1 piste fyysisestä työstä' : `${String(count)} pistettä fyysisestä työstä`,
    meta: (count) => (count === 1 ? '1 piste metatyöstä' : `${String(count)} pistettä metatyöstä`),
  },
  byMember: (title) => `${title} jäsenittäin`,
  fairness: 'Reiluus',
  fairnessLabels: {
    balanced: 'Tasapainoinen',
    slightlyUneven: 'Hieman epätasainen',
    uneven: 'Epätasainen',
  },
};
