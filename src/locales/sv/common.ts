import type { Messages } from '@/locales/en';

const weekdays = ['sön', 'mån', 'tis', 'ons', 'tors', 'fre', 'lör'];
const months = [
  'jan',
  'feb',
  'mars',
  'apr',
  'maj',
  'juni',
  'juli',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
];

/** "Bens", but "Lars": Swedish adds no s to a name already ending in s, x or z. */
export const possessive = (name: string) => (/[sxz]$/i.test(name) ? name : `${name}s`);

/** "3:e", "2:a", "21:a", "11:e": the number with its ordinal ending. */
export const ordinal = (count: number) => {
  const lastTwo = count % 100;
  const endsInA = (count % 10 === 1 || count % 10 === 2) && lastTwo !== 11 && lastTwo !== 12;
  return `${String(count)}:${endsInA ? 'a' : 'e'}`;
};

export const common: Messages['common'] = {
  loading: 'Laddar…',
  cancel: 'Avbryt',
  save: 'Spara',
  delete: 'Ta bort',
  yesDelete: 'Ja, ta bort',
  keepIt: 'Behåll',
  logOut: 'Logga ut',
  you: 'Du',
  someone: 'Någon',
  newMember: 'Ny medlem (inget namn än)',
  taskTypes: { physical: 'Fysiskt', meta: 'Metaarbete' },
  points: (count) => (count === 1 ? '1 poäng' : `${String(count)} poäng`),
  joinNames: (names) =>
    names.length <= 1
      ? names.join('')
      : `${names.slice(0, -1).join(', ')} och ${names.at(-1) ?? ''}`,
  helpedBy: (shares) => `Hjälp av ${common.joinNames(shares)}`,
  share: (name, count) => `${name} (${common.points(count)})`,
  today: 'I dag',
  tomorrow: 'I morgon',
  yesterday: 'I går',
  /** "tors 8 okt" */
  shortDate: (date) =>
    `${weekdays[date.getDay()] ?? ''} ${String(date.getDate())} ${months[date.getMonth()] ?? ''}`,
  /** "tors" */
  weekday: (date) => weekdays[date.getDay()] ?? '',
  /** "8 okt" */
  dayAndMonth: (date) => `${String(date.getDate())} ${months[date.getMonth()] ?? ''}`,
  /** "9.05", "18.00": the time as Språkrådet writes it. */
  time: (date) => `${String(date.getHours())}.${String(date.getMinutes()).padStart(2, '0')}`,
};
