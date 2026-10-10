import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { NewsCard } from '@/features/news/NewsCard';
import { describeSummary, groupByDay, nameFor, type NewsDay } from '@/features/news/news';
import { useNews } from '@/features/news/useNews';
import { useLoggedInUser } from '@/lib/auth';
import { today } from '@/lib/dates';

export function NewsPage() {
  const user = useLoggedInUser();
  const news = useNews(user.id);

  return (
    <>
      <PageHeader
        eyebrow="News"
        title="What the family has done"
        description="Shared tasks done in the last week. Give a thumbs up or leave a comment."
      />
      <NewsBody news={news} userId={user.id} />
    </>
  );
}

function NewsBody({ news, userId }: { news: ReturnType<typeof useNews>; userId: string }) {
  if (news.data === undefined) {
    if (!news.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-sm text-red-700">
        We couldn&apos;t load the news. Check your connection and reload the page.
      </p>
    );
  }
  if (news.data.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
        No shared tasks done in the last week yet. When someone marks one done, it shows up here.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {groupByDay(news.data, today()).map((day) => (
        <NewsDaySection key={day.label} day={day} userId={userId} />
      ))}
    </div>
  );
}

function NewsDaySection({ day, userId }: { day: NewsDay; userId: string }) {
  const headingId = `news-${day.label.replaceAll(' ', '-')}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-lg font-semibold text-slate-900">
        {day.label}
      </h2>
      <ul
        aria-label="Points earned"
        className="bg-brand-50 text-brand-900 flex flex-col gap-1 rounded-2xl px-4 py-3 text-sm"
      >
        {day.summaries.map((summary) => (
          <li key={summary.member.userId ?? 'someone'}>
            {describeSummary(summary, nameFor(summary.member, userId))}
          </li>
        ))}
      </ul>
      <ul aria-label="Tasks done" className="flex flex-col gap-3">
        {day.items.map((item) => (
          <NewsCard key={item.taskId} item={item} userId={userId} />
        ))}
      </ul>
    </section>
  );
}
