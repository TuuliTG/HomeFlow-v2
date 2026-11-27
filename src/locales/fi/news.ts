import type { Messages } from '@/locales/en';
import { common } from '@/locales/fi/common';

export const news: Messages['news'] = {
  title: 'Mitä perhe on tehnyt',
  loadFailed: 'Uutisia ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
  empty: 'Viimeisen viikon aikana ei ole vielä tehty yhteisiä tehtäviä.',
  pointsEarned: 'Ansaitut pisteet',
  tasksDone: 'Tehdyt tehtävät',
  // "Anna: 10 pistettä (…)" rather than a verb, which would have to agree with "Sinä".
  summary: (name, physicalPoints, metaPoints) => {
    if (metaPoints === 0) return `${name}: ${common.points(physicalPoints)} fyysisestä työstä`;
    if (physicalPoints === 0) return `${name}: ${common.points(metaPoints)} metatyöstä`;
    return `${name}: ${common.points(physicalPoints + metaPoints)} (${String(physicalPoints)} fyysistä, ${String(metaPoints)} metatyötä)`;
  },
  completed: { you: 'teit tehtävän', other: 'teki tehtävän' },
  react: 'Reagoi',
  reactTo: (title) => `Reagoi: ${title}`,
  reactions: 'Reaktiot',
  reactFailed: 'Reaktiota ei voitu tallentaa. Yritä uudelleen.',
  comments: 'Kommentit',
  comment: 'Kommentoi',
  commentOn: (title) => `Kommentoi: ${title}`,
  commentPlaceholder: 'Kiitä tai lisää huomio',
  send: 'Lähetä',
  writeFirst: 'Kirjoita ensin kommentti.',
  sendFailed: 'Kommenttia ei voitu lähettää. Yritä uudelleen.',
  deleteLabel: (body) => `Poista kommenttisi: ${body}`,
  deleteFailed: 'Kommenttia ei voitu poistaa. Yritä uudelleen.',
};
