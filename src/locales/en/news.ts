import { common } from '@/locales/en/common';

/** The News tab: done tasks, thumbs up and comments. */
export const news = {
  eyebrow: 'News',
  title: 'What the family has done',
  description: 'Shared tasks done in the last week. Give a thumbs up or leave a comment.',
  loadFailed: "We couldn't load the news. Check your connection and reload the page.",
  empty:
    'No shared tasks done in the last week yet. When someone marks one done, it shows up here.',
  pointsEarned: 'Points earned',
  tasksDone: 'Tasks done',
  /** "Ben earned 10 points: 7 physical, 3 meta work", or "You earned 3 points of meta work". */
  summary: (name: string, physicalPoints: number, metaPoints: number) => {
    if (metaPoints === 0) return `${name} earned ${common.points(physicalPoints)} of physical work`;
    if (physicalPoints === 0) return `${name} earned ${common.points(metaPoints)} of meta work`;
    return `${name} earned ${common.points(physicalPoints + metaPoints)}: ${String(physicalPoints)} physical, ${String(metaPoints)} meta work`;
  },
  /** The verb between who did a task and its name: "Ben completed Vacuum". */
  completed: { you: 'completed', other: 'completed' },
  thumbsUp: 'Thumbs up',
  thumbsUpLabel: (title: string) => `Thumbs up: ${title}`,
  likedBy: (names: string[]) => `${common.joinNames(names)} gave a thumbs up`,
  likeFailed: "We couldn't save your thumbs up. Try again.",
  comments: 'Comments',
  comment: 'Comment',
  commentOn: (title: string) => `Comment on ${title}`,
  commentPlaceholder: 'Say thanks or add a note',
  send: 'Send',
  writeFirst: 'Write a comment first.',
  sendFailed: "We couldn't send your comment. Try again.",
  deleteLabel: (body: string) => `Delete your comment: ${body}`,
  deleteFailed: "We couldn't delete your comment. Try again.",
};
