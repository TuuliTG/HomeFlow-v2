import { useState } from 'react';

import { CommentIcon, StarIcon, ThumbsUpIcon } from '@/components/ui/icons';
import { TaskTypeIcon } from '@/components/ui/TaskTypeIcon';
import { CommentForm, CommentList } from '@/features/news/CommentThread';
import { nameFor, type NewsItem } from '@/features/news/news';
import { useToggleLike } from '@/features/news/useNews';
import { useMessages } from '@/lib/i18n/i18n';

const actionClassName =
  'flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold';
const idleActionClassName =
  'border-line-strong text-ink hover:border-brand-600 hover:text-brand-900';

/** One done task: who did it, its points, thumbs up and comments. */
export function NewsCard({ item, userId }: { item: NewsItem; userId: string }) {
  const t = useMessages();
  const [isWriting, setIsWriting] = useState(false);
  const doer = nameFor(item.doneBy, userId, t);
  const completed = t.news.completed[item.doneBy.userId === userId ? 'you' : 'other'];
  return (
    <li
      aria-label={`${doer} ${completed} ${item.title}`}
      className="bg-surface shadow-card flex flex-col gap-3 rounded-2xl p-4"
    >
      <div className="flex items-start gap-3">
        <TaskTypeIcon type={item.type} icon={item.icon} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-ink-muted text-sm">
            <span className="text-ink font-semibold">{doer}</span> {completed}
          </p>
          <h3 className="text-ink text-[1.0625rem] leading-snug font-bold">{item.title}</h3>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span
              className={`rounded-full px-2.5 py-0.5 font-semibold ${
                item.type === 'meta' ? 'bg-meta-100 text-meta-800' : 'bg-brand-100 text-brand-900'
              }`}
            >
              {t.common.taskTypes[item.type]}
            </span>
            <time dateTime={item.completedAt} className="text-ink-muted">
              {t.common.time(new Date(item.completedAt))}
            </time>
          </div>
          {item.helpers.length > 0 && (
            <p className="text-ink-muted text-sm">
              {t.common.helpedBy(
                item.helpers.map(({ person, points }) =>
                  t.common.share(nameFor(person, userId, t), points),
                ),
              )}
            </p>
          )}
        </div>
        <Points points={item.points} />
      </div>
      <div className="border-line flex flex-col gap-3 border-t pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <ThumbsUp item={item} userId={userId} />
          {!isWriting && (
            <button
              type="button"
              aria-label={t.news.commentOn(item.title)}
              onClick={() => {
                setIsWriting(true);
              }}
              className={`${actionClassName} ${idleActionClassName}`}
            >
              <CommentIcon className="size-5" />
              {t.news.comment}
            </button>
          )}
        </div>
        <LikedBy item={item} userId={userId} />
        <CommentList item={item} userId={userId} />
        {isWriting && (
          <CommentForm
            item={item}
            userId={userId}
            onDone={() => {
              setIsWriting(false);
            }}
          />
        )}
      </div>
    </li>
  );
}

/** The task's points as a pill, like on the task's card, or that an adult has yet to award them. */
function Points({ points }: { points: number | null }) {
  const t = useMessages();
  return (
    <span className="bg-points-100 text-points-800 -mt-1 -mr-1 ml-auto flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-extrabold whitespace-nowrap">
      {points === null ? (
        t.tasks.card.waitingForPoints
      ) : (
        <>
          <StarIcon className="size-4 fill-current" />
          {t.common.points(points)}
        </>
      )}
    </span>
  );
}

/** Thumbs up for a task someone else did; the user can't give one to their own. */
function ThumbsUp({ item, userId }: { item: NewsItem; userId: string }) {
  const toggleLike = useToggleLike(userId);
  const t = useMessages();
  if (item.doneBy.userId === userId) return null;
  const liked = item.likedBy.some((person) => person.userId === userId);

  return (
    <>
      <button
        type="button"
        aria-pressed={liked}
        aria-label={t.news.thumbsUpLabel(item.title)}
        onClick={() => {
          toggleLike.mutate({ taskId: item.taskId, liked: !liked });
        }}
        className={`${actionClassName} ${
          liked ? 'border-brand-600 bg-brand-600 text-white' : idleActionClassName
        }`}
      >
        <ThumbsUpIcon className="size-5" />
        {t.news.thumbsUp}
      </button>
      {toggleLike.isError && (
        <p role="alert" className="text-danger-700 w-full text-sm">
          {t.news.likeFailed}
        </p>
      )}
    </>
  );
}

function LikedBy({ item, userId }: { item: NewsItem; userId: string }) {
  const t = useMessages();
  if (item.likedBy.length === 0) return null;
  // The user first, as "You".
  const likers = [...item.likedBy]
    .sort((a, b) => Number(b.userId === userId) - Number(a.userId === userId))
    .map((person) => nameFor(person, userId, t));
  return (
    <p className="text-ink-muted flex items-center gap-1.5 text-sm">
      <span
        aria-hidden="true"
        className="bg-brand-600 flex size-5 items-center justify-center rounded-full text-white"
      >
        <ThumbsUpIcon className="size-3" />
      </span>
      {t.news.likedBy(likers)}
    </p>
  );
}
