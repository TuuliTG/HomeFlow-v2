import { useId } from 'react';

import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { NewsCard } from '@/features/news/NewsCard';
import { groupByDay, nameFor, type NewsDay } from '@/features/news/news';
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
      <h2 id={headingId} className="text-ink text-lg font-semibold">
        {day.label}
      </h2>
      <ul
        aria-label={t.news.pointsEarned}
        className="bg-brand-50 text-brand-900 flex flex-col gap-1 rounded-2xl px-4 py-3 text-sm"
      >
        {day.summaries.map((summary) => (
          <li key={summary.member.userId ?? 'someone'}>
            {t.news.summary(
              nameFor(summary.member, userId, t),
              summary.physicalPoints,
              summary.metaPoints,
            )}
          </li>
        ))}
      </ul>
      <ul aria-label={t.news.tasksDone} className="flex flex-col gap-3">
        {day.items.map((item) => (
          <NewsCard key={item.taskId} item={item} userId={userId} />
        ))}
      </ul>
    </section>
  );
}
