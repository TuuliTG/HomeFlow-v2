import type { Messages } from '@/locales/en';

/** "15 min", "1 h", "1 h 30 min". */
const duration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} min`;
  return rest === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(rest)} min`;
};

export const schedule: Messages['schedule'] = {
  viewLegend: 'Visa dina uppgifter som',
  views: { list: 'Lista', day: 'Dag', week: 'Vecka' },
  timetable: 'Schema',
  previousDay: 'Föregående dag',
  nextDay: 'Nästa dag',
  previousWeek: 'Föregående vecka',
  nextWeek: 'Nästa vecka',
  range: (first, last) => `${first} – ${last}`,
  plannedFor: (day) => `Planerat för ${day}`,
  block: (title, from, to) => `${title}, ${from}–${to}`,
  loadFailed: 'Det gick inte att ladda ditt schema. Kontrollera anslutningen och ladda om sidan.',
  notScheduled: 'Inte schemalagd än',
  nothingToPlan: 'Inget att planera än.',
  allScheduled: 'Alla dina uppgifter finns i schemat.',
  scheduleLabel: (title) => `Schemalägg: ${title}`,
  addAt: (day) => `Planera en uppgift: ${day}`,
  at: (day, time) => `${day} kl. ${time}`,
  placeHere: 'Dina uppgifter som inte är schemalagda än',
  addNewTask: 'Lägg till en ny uppgift',
  addingAt: (day, time) =>
    `Den hamnar i ditt schema ${day} kl. ${time}. En gemensam uppgift tas av dig.`,
  when: (day, from, to) => `${day}, ${from}–${to}`,
  changeTime: 'Ändra tid',
  changeTimeLabel: (title) => `Ändra tid: ${title}`,
  close: 'Stäng',
  formLabel: (title) => `När du gör ${title}`,
  day: 'Dag',
  start: 'Start',
  length: 'Längd',
  duration,
  save: 'Spara',
  remove: 'Ta bort från schemat',
  invalidStart: 'Välj en dag och en starttid.',
  tooFar: 'Välj en dag inom ett år från i dag.',
  saveFailed: 'Det gick inte att spara. Försök igen.',
  removeFailed: 'Det gick inte att ta bort det från schemat. Försök igen.',
  moveFailed: 'Det gick inte att flytta uppgiften. Försök igen.',
  dragging: (title) => `Flyttar ${title}`,
  dropped: (title, day, time) => `${title} planerad ${day} kl. ${time}`,
  notMoved: (title) => `${title} flyttades inte`,
};
