import type { Messages } from '@/locales/en';

/** "15 min", "1 h", "1 h 30 min". */
const duration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} min`;
  return rest === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(rest)} min`;
};

export const schedule: Messages['schedule'] = {
  viewLegend: 'Näytä tehtäväsi',
  views: { list: 'Lista', day: 'Päivä', week: 'Viikko' },
  description: 'Suunnittele, milloin teet tehtäväsi. Aikataulusi näkyy vain sinulle.',
  timetable: 'Aikataulu',
  previousDay: 'Edellinen päivä',
  nextDay: 'Seuraava päivä',
  previousWeek: 'Edellinen viikko',
  nextWeek: 'Seuraava viikko',
  range: (first, last) => `${first} – ${last}`,
  plannedFor: (day) => `Suunniteltu: ${day}`,
  block: (title, from, to) => `${title}, ${from}–${to}`,
  loadFailed: 'Aikatauluasi ei voitu ladata. Tarkista yhteys ja lataa sivu uudelleen.',
  notScheduled: 'Ei vielä aikataulussa',
  dragHint: 'Vedä tehtävä aikatauluun (puhelimella paina sitä ensin hetken) tai valitse Ajoita.',
  allScheduled: 'Kaikki tehtäväsi ovat aikataulussa.',
  schedule: 'Ajoita',
  scheduleLabel: (title) => `Ajoita: ${title}`,
  formLabel: (title) => `Milloin teet: ${title}`,
  day: 'Päivä',
  start: 'Alkaa',
  length: 'Kesto',
  duration,
  save: 'Tallenna',
  remove: 'Poista aikataulusta',
  invalidStart: 'Valitse päivä ja alkamisaika.',
  tooFar: 'Valitse päivä vuoden sisältä.',
  saveFailed: 'Tätä ei voitu tallentaa. Yritä uudelleen.',
  removeFailed: 'Tätä ei voitu poistaa aikataulusta. Yritä uudelleen.',
  moveFailed: 'Tehtävää ei voitu siirtää. Yritä uudelleen.',
  dragging: (title) => `Siirretään: ${title}`,
  dropped: (title, day, time) => `${title} suunniteltu: ${day} klo ${time}`,
  notMoved: (title) => `${title} ei siirtynyt`,
};
