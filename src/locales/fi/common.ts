import type { Messages } from '@/locales/en';

const weekdays = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];

export const common: Messages['common'] = {
  loading: 'Ladataan…',
  cancel: 'Peruuta',
  save: 'Tallenna',
  delete: 'Poista',
  yesDelete: 'Kyllä, poista',
  keepIt: 'Älä poista',
  logOut: 'Kirjaudu ulos',
  you: 'Sinä',
  someone: 'Joku',
  newMember: 'Uusi jäsen (ei vielä nimeä)',
  taskTypes: { physical: 'Fyysinen', meta: 'Metatyö' },
  points: (count) => (count === 1 ? '1 piste' : `${String(count)} pistettä`),
  joinNames: (names) =>
    names.length <= 1
      ? names.join('')
      : `${names.slice(0, -1).join(', ')} ja ${names.at(-1) ?? ''}`,
  helpedBy: (shares) => `Apuna: ${common.joinNames(shares)}`,
  share: (name, count) => `${name} (${common.points(count)})`,
  today: 'Tänään',
  tomorrow: 'Huomenna',
  yesterday: 'Eilen',
  /** "to 8.10." */
  shortDate: (date) =>
    `${weekdays[date.getDay()] ?? ''} ${String(date.getDate())}.${String(date.getMonth() + 1)}.`,
  /** "8.10." */
  dayAndMonth: (date) => `${String(date.getDate())}.${String(date.getMonth() + 1)}.`,
  /** "9.05", "18.00". */
  time: (date) => `${String(date.getHours())}.${String(date.getMinutes()).padStart(2, '0')}`,
};
