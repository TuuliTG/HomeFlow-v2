import { addDays, formatShortDate, fromIsoDate, toIsoDate } from '@/lib/dates';

/** How many days back the news goes, today included. */
const NEWS_DAYS = 7;

export const workTypes = ['physical', 'meta'] as const;
type WorkType = (typeof workTypes)[number];

export interface NewsPerson {
  userId: string | null;
  /** Their display name; null if they haven't chosen one or have left the household. */
  name: string | null;
}

export interface NewsComment {
  id: string;
  author: NewsPerson;
  body: string;
  /** ISO timestamp. */
  createdAt: string;
}

/** A shared task someone in the household has done, with the thumbs up and comments it got. */
export interface NewsItem {
  taskId: string;
  title: string;
  type: WorkType;
  points: number;
  /** ISO timestamp. */
  completedAt: string;
  doneBy: NewsPerson;
  likedBy: NewsPerson[];
  /** Oldest first. */
  comments: NewsComment[];
}

/** The points one member earned in a day, physical and meta work apart. */
export interface DaySummary {
  member: NewsPerson;
  physicalPoints: number;
  metaPoints: number;
}

export interface NewsDay {
  /** "Today", "Yesterday" or "Thu 8 Oct". */
  label: string;
  /** Who earned the most points first. */
  summaries: DaySummary[];
  /** Newest first. */
  items: NewsItem[];
}

/** Local midnight `NEWS_DAYS - 1` days before `todayDate`: where the news starts. */
export function newsStart(todayDate: string): Date {
  return fromIsoDate(addDays(todayDate, 1 - NEWS_DAYS));
}

function dayLabel(date: string, todayDate: string): string {
  if (date === todayDate) return 'Today';
  if (date === addDays(todayDate, -1)) return 'Yesterday';
  return formatShortDate(fromIsoDate(date));
}

function summarise(items: NewsItem[]): DaySummary[] {
  const byMember = new Map<string | null, DaySummary>();
  for (const { doneBy, type, points } of items) {
    const summary = byMember.get(doneBy.userId) ?? {
      member: doneBy,
      physicalPoints: 0,
      metaPoints: 0,
    };
    if (type === 'meta') summary.metaPoints += points;
    else summary.physicalPoints += points;
    byMember.set(doneBy.userId, summary);
  }
  const total = (summary: DaySummary) => summary.physicalPoints + summary.metaPoints;
  return [...byMember.values()].sort((a, b) => total(b) - total(a));
}

/** Splits news items, newest first, by the local day they were done, with each member's points that day. */
export function groupByDay(items: NewsItem[], todayDate: string): NewsDay[] {
  const days: (NewsDay & { date: string })[] = [];
  for (const item of items) {
    const date = toIsoDate(new Date(item.completedAt));
    const last = days.at(-1);
    if (last?.date === date) last.items.push(item);
    else days.push({ date, label: dayLabel(date, todayDate), summaries: [], items: [item] });
  }
  return days.map(({ label, items: dayItems }) => ({
    label,
    summaries: summarise(dayItems),
    items: dayItems,
  }));
}

function pointsText(points: number): string {
  return points === 1 ? '1 point' : `${String(points)} points`;
}

/** "Ben earned 10 points: 7 physical, 3 meta work", or "You earned 3 points of meta work". */
export function describeSummary(summary: DaySummary, name: string): string {
  const { physicalPoints, metaPoints } = summary;
  if (metaPoints === 0) return `${name} earned ${pointsText(physicalPoints)} of physical work`;
  if (physicalPoints === 0) return `${name} earned ${pointsText(metaPoints)} of meta work`;
  return `${name} earned ${pointsText(physicalPoints + metaPoints)}: ${String(physicalPoints)} physical, ${String(metaPoints)} meta work`;
}

/** "Anna", "Anna and Ben", "Anna, Ben and Carl". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

/** Comments are trimmed and 1–500 characters, like `task_comments.body`. */
export const COMMENT_MAX_LENGTH = 500;

/** "14:05", the local time of an ISO timestamp. */
export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** How a person is named to the user: "You", their display name, or "Someone". */
export function nameFor(person: NewsPerson, userId: string): string {
  if (person.userId === userId) return 'You';
  return person.name ?? 'Someone';
}
