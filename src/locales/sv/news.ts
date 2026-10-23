import type { Messages } from '@/locales/en';
import { common } from '@/locales/sv/common';

export const news: Messages['news'] = {
  eyebrow: 'Nyheter',
  title: 'Vad familjen har gjort',
  loadFailed: 'Det gick inte att ladda nyheterna. Kontrollera anslutningen och ladda om sidan.',
  empty: 'Inga gemensamma uppgifter gjorda den senaste veckan än.',
  pointsEarned: 'Intjänade poäng',
  tasksDone: 'Gjorda uppgifter',
  summary: (name, physicalPoints, metaPoints) => {
    if (metaPoints === 0) return `${name} fick ${common.points(physicalPoints)} för fysiskt arbete`;
    if (physicalPoints === 0) return `${name} fick ${common.points(metaPoints)} för metaarbete`;
    return `${name} fick ${common.points(physicalPoints + metaPoints)}: ${String(physicalPoints)} fysiskt, ${String(metaPoints)} metaarbete`;
  },
  completed: { you: 'gjorde', other: 'gjorde' },
  thumbsUp: 'Tummen upp',
  thumbsUpLabel: (title) => `Tummen upp: ${title}`,
  likedBy: (names) => `${common.joinNames(names)} gav tummen upp`,
  likeFailed: 'Det gick inte att spara din tumme upp. Försök igen.',
  comments: 'Kommentarer',
  comment: 'Kommentera',
  commentOn: (title) => `Kommentera ${title}`,
  commentPlaceholder: 'Säg tack eller lägg till en anteckning',
  send: 'Skicka',
  writeFirst: 'Skriv en kommentar först.',
  sendFailed: 'Det gick inte att skicka kommentaren. Försök igen.',
  deleteLabel: (body) => `Ta bort din kommentar: ${body}`,
  deleteFailed: 'Det gick inte att ta bort kommentaren. Försök igen.',
};
