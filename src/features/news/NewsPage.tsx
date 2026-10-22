import { useId } from 'react';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { NewsCard } from '@/features/news/NewsCard';
import { type DaySummary, groupByDay, nameFor, type NewsDay } from '@/features/news/news';
import { useNews } from '@/features/news/useNews';
import { useLoggedInUser } from '@/lib/auth';
import { today } from '@/lib/dates';
import { useMessages } from '@/lib/i18n/i18n';

export function NewsPage() {
  const user = useLoggedInUser();
  const news = useNews(user.id);
  const t = useMessages().news;

  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={t.title} />
      <NewsBody news={news} userId={user.id} />
    </>
  );
}

function NewsBody({ news, userId }: { news: ReturnType<typeof useNews>; userId: string }) {
  const t = useMessages();
  if (news.data === undefined) {
    if (!news.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {t.news.loadFailed}
      </p>
    );
  }
  if (news.data.length === 0) {
    return (
      <p className="border-line-strong bg-surface text-ink-muted rounded-2xl border border-dashed p-6 text-sm">
        {t.news.empty}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {groupByDay(news.data, today(), t).map((day) => (
        <NewsDaySection key={day.label} day={day} userId={userId} />
      ))}
    </div>
  );
}

function NewsDaySection({ day, userId }: { day: NewsDay; userId: string }) {
  const headingId = useId();
  const t = useMessages();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2
        id={headingId}
        className="text-brand-900 flex items-center gap-2 text-sm font-extrabold tracking-wide uppercase"
      >
        <span aria-hidden="true" className="bg-brand-600 size-2 rounded-full" />
        {day.label}
      </h2>
      <DaySummaries summaries={day.summaries} userId={userId} />
      <ul aria-label={t.news.tasksDone} className="flex flex-col gap-3">
        {day.items.map((item) => (
          <NewsCard key={item.taskId} item={item} userId={userId} />
        ))}
      </ul>
    </section>
  );
}

const totalOf = (summary: DaySummary) => summary.physicalPoints + summary.metaPoints;

/** Each member's points that day, with a bar split into physical and meta work, the most first. */
function DaySummaries({ summaries, userId }: { summaries: DaySummary[]; userId: string }) {
  const t = useMessages();
  const most = Math.max(...summaries.map(totalOf), 1);
  const widthOf = (points: number) => `${String((points / most) * 100)}%`;
  return (
    <ul
      aria-label={t.news.pointsEarned}
      className="bg-surface shadow-card flex flex-col gap-3 rounded-2xl p-4 text-sm"
    >
      {summaries.map((summary) => (
        <li key={summary.member.userId ?? 'someone'} className="flex flex-col gap-1.5">
          <span className="text-ink">
            {t.news.summary(
              nameFor(summary.member, userId, t),
              summary.physicalPoints,
              summary.metaPoints,
            )}
          </span>
          <div aria-hidden="true" className="bg-line flex h-2 overflow-hidden rounded-full">
            <div className="bg-brand-600" style={{ width: widthOf(summary.physicalPoints) }} />
            <div className="bg-meta-500" style={{ width: widthOf(summary.metaPoints) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
