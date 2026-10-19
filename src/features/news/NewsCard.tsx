import { ThumbsUpIcon } from '@/components/ui/icons';
import { CommentThread } from '@/features/news/CommentThread';
import { nameFor, type NewsItem } from '@/features/news/news';
import { useToggleLike } from '@/features/news/useNews';
import { useMessages } from '@/lib/i18n/i18n';

/** One done task: who did it, its points, thumbs up and comments. */
export function NewsCard({ item, userId }: { item: NewsItem; userId: string }) {
  const t = useMessages();
  const doer = nameFor(item.doneBy, userId, t);
  const completed = t.news.completed[item.doneBy.userId === userId ? 'you' : 'other'];
  return (
    <li
      aria-label={`${doer} ${completed} ${item.title}`}
      className="bg-surface shadow-card flex flex-col gap-3 rounded-2xl p-4"
    >
      <div className="flex flex-col gap-0.5 text-sm">
        <p className="text-ink">
          <span className="font-semibold">{doer}</span> {completed}{' '}
          <span className="font-semibold">{item.title}</span>
        </p>
        <p className="text-ink-muted">
          {item.points === null ? t.tasks.card.waitingForPoints : t.common.points(item.points)} ·{' '}
          <span className={item.type === 'meta' ? 'text-meta-700' : undefined}>
            {t.common.taskTypes[item.type]}
          </span>{' '}
          · {t.common.time(new Date(item.completedAt))}
        </p>
        {item.helpers.length > 0 && (
          <p className="text-ink-muted">
            {t.common.helpedBy(
              item.helpers.map(({ person, points }) =>
                t.common.share(nameFor(person, userId, t), points),
              ),
            )}
          </p>
        )}
      </div>
      <Likes item={item} userId={userId} />
      <CommentThread item={item} userId={userId} />
    </li>
  );
}

function Likes({ item, userId }: { item: NewsItem; userId: string }) {
  const toggleLike = useToggleLike(userId);
  const t = useMessages();
  const isOwn = item.doneBy.userId === userId;
  const liked = item.likedBy.some((person) => person.userId === userId);
  // The user first, as "You".
  const likers = [...item.likedBy]
    .sort((a, b) => Number(b.userId === userId) - Number(a.userId === userId))
    .map((person) => nameFor(person, userId, t));
  if (isOwn && likers.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {!isOwn && (
        <button
          type="button"
          aria-pressed={liked}
          aria-label={t.news.thumbsUpLabel(item.title)}
          onClick={() => {
            toggleLike.mutate({ taskId: item.taskId, liked: !liked });
          }}
          className={[
            'flex min-h-11 items-center gap-2 rounded-full border px-4 font-semibold',
            liked
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'hover:border-brand-600 hover:text-brand-900 border-line-strong text-ink',
          ].join(' ')}
        >
          <ThumbsUpIcon className="size-5" />
          {t.news.thumbsUp}
        </button>
      )}
      {likers.length > 0 && (
        <p className="text-ink-muted">
          <span aria-hidden="true">👍 </span>
          {t.news.likedBy(likers)}
        </p>
      )}
      {toggleLike.isError && (
        <p role="alert" className="text-danger-700 w-full">
          {t.news.likeFailed}
        </p>
      )}
    </div>
  );
}
