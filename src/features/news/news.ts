import { addDays, fromIsoDate, toIsoDate } from '@/lib/dates';
import type { Messages } from '@/lib/i18n/i18n';
import type { TaskIconName } from '@/lib/taskIcons';

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

/** Someone who helped with a task, and their share of its points. */
interface NewsHelper {
  person: NewsPerson;
  points: number;
}

/** A shared task someone in the household has done, with the thumbs up and comments it got. */
export interface NewsItem {
  taskId: string;
  title: string;
  type: WorkType;
  icon: TaskIconName | null;
  /** Null for a child's task until an adult awards its points. */
  points: number | null;
  /** ISO timestamp. */
  completedAt: string;
  doneBy: NewsPerson;
  /** Their shares come out of the task's points; the rest is the doer's. */
  helpers: NewsHelper[];
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

function dayLabel(date: string, todayDate: string, t: Messages): string {
  if (date === todayDate) return t.common.today;
  if (date === addDays(todayDate, -1)) return t.common.yesterday;
  return t.common.shortDate(fromIsoDate(date));
}

/** Who earned the item's points: the doer what the helpers didn't get, and each helper their share. */
function creditsOf({ doneBy, helpers, points }: NewsItem): NewsHelper[] {
  const helped = helpers.reduce((total, helper) => total + helper.points, 0);
  return [{ person: doneBy, points: (points ?? 0) - helped }, ...helpers];
}

function summarise(items: NewsItem[]): DaySummary[] {
  const byMember = new Map<string | null, DaySummary>();
  for (const item of items) {
    for (const { person, points } of creditsOf(item)) {
      const summary = byMember.get(person.userId) ?? {
        member: person,
        physicalPoints: 0,
        metaPoints: 0,
      };
      if (item.type === 'meta') summary.metaPoints += points;
      else summary.physicalPoints += points;
      byMember.set(person.userId, summary);
    }
  }
  const total = (summary: DaySummary) => summary.physicalPoints + summary.metaPoints;
  return [...byMember.values()].sort((a, b) => total(b) - total(a));
}

/** Splits news items, newest first, by the local day they were done, with each member's points that day. */
export function groupByDay(items: NewsItem[], todayDate: string, t: Messages): NewsDay[] {
  const days: (NewsDay & { date: string })[] = [];
  for (const item of items) {
    const date = toIsoDate(new Date(item.completedAt));
    const last = days.at(-1);
    if (last?.date === date) last.items.push(item);
    else days.push({ date, label: dayLabel(date, todayDate, t), summaries: [], items: [item] });
  }
  return days.map(({ label, items: dayItems }) => ({
    label,
    summaries: summarise(dayItems),
    items: dayItems,
  }));
}

/** Comments are trimmed and 1–500 characters, like `task_comments.body`. */
export const COMMENT_MAX_LENGTH = 500;

/** How a person is named to the user: "You", their display name, or "Someone". */
export function nameFor(person: NewsPerson, userId: string, t: Messages): string {
  if (person.userId === userId) return t.common.you;
  return person.name ?? t.common.someone;
}
