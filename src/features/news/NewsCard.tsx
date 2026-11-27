import { useState } from 'react';

import { CommentIcon, SmileIcon, StarIcon } from '@/components/ui/icons';
import { TaskTypeIcon } from '@/components/ui/TaskTypeIcon';
import { CommentForm, CommentList } from '@/features/news/Comments';
import {
  groupReactions,
  nameFor,
  type NewsItem,
  type Reaction,
  reactions,
} from '@/features/news/news';
import { useReact } from '@/features/news/useNews';
import { useMessages } from '@/lib/i18n/i18n';

const actionClassName =
  'flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold';
const idleActionClassName =
  'border-line-strong text-ink hover:border-brand-600 hover:text-brand-900';

/** One done task: who did it, its points, reactions and comments. */
export function NewsCard({ item, userId }: { item: NewsItem; userId: string }) {
  const t = useMessages();
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
            {item.points === null && (
              <span className="bg-points-100 text-points-800 rounded-full px-2.5 py-0.5 font-semibold">
                {t.tasks.card.waitingForPoints}
              </span>
            )}
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
        {item.points !== null && <Points points={item.points} />}
      </div>
      <Responses item={item} userId={userId} />
    </li>
  );
}

/** Reactions and comments on a task, with the buttons to add them. */
function Responses({ item, userId }: { item: NewsItem; userId: string }) {
  const t = useMessages();
  const [isWriting, setIsWriting] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const react = useReact(userId);
  return (
    <div className="border-line flex flex-col gap-3 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {item.doneBy.userId !== userId && (
          <ReactButton
            item={item}
            userId={userId}
            isOpen={isReacting}
            onToggle={() => {
              setIsReacting(!isReacting);
            }}
          />
        )}
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
      {isReacting && (
        <ReactionPicker
          own={ownReaction(item, userId)}
          label={t.news.reactTo(item.title)}
          onPick={(emoji) => {
            react.mutate({ taskId: item.taskId, emoji });
            setIsReacting(false);
          }}
        />
      )}
      {react.isError && (
        <p role="alert" className="text-danger-700 text-sm">
          {t.news.reactFailed}
        </p>
      )}
      <Reactions item={item} userId={userId} />
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
  );
}

/** The task's points as a pill, like on the task's card. */
function Points({ points }: { points: number }) {
  const t = useMessages();
  return (
    <span className="bg-points-100 text-points-800 -mt-1 -mr-1 ml-auto flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-extrabold whitespace-nowrap">
      <StarIcon className="size-4 fill-current" />
      {t.common.points(points)}
    </span>
  );
}

function ownReaction(item: NewsItem, userId: string) {
  return item.reactions.find((reaction) => reaction.person.userId === userId)?.emoji;
}

/** Opens the emoji to react with; shows the user's own once they have reacted. */
function ReactButton({
  item,
  userId,
  isOpen,
  onToggle,
}: {
  item: NewsItem;
  userId: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const t = useMessages();
  const own = ownReaction(item, userId);
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-label={t.news.reactTo(item.title)}
      onClick={onToggle}
      className={`${actionClassName} ${
        own ? 'border-brand-600 bg-brand-100 text-brand-900' : idleActionClassName
      }`}
    >
      {own ? (
        <span aria-hidden="true" className="text-lg leading-none">
          {own}
        </span>
      ) : (
        <SmileIcon className="size-5" />
      )}
      {t.news.react}
    </button>
  );
}

/** The emoji to react with; the user's current one again (`null`) takes it back. */
function ReactionPicker({
  own,
  label,
  onPick,
}: {
  own: Reaction | undefined;
  label: string;
  onPick: (emoji: Reaction | null) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {reactions.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-pressed={emoji === own}
          onClick={() => {
            onPick(emoji === own ? null : emoji);
          }}
          className={`flex size-11 items-center justify-center rounded-full text-2xl ${
            emoji === own ? 'bg-brand-100 ring-brand-600 ring-2' : 'hover:bg-page'
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** Who reacted with which emoji, the user first. */
function Reactions({ item, userId }: { item: NewsItem; userId: string }) {
  const t = useMessages();
  if (item.reactions.length === 0) return null;
  return (
    <ul aria-label={t.news.reactions} className="flex flex-wrap gap-1.5">
      {groupReactions(item.reactions, userId).map(({ emoji, people }) => (
        <li
          key={emoji}
          className="bg-page text-ink-muted flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm"
        >
          <span className="text-base leading-none">{emoji}</span>
          {t.common.joinNames(people.map((person) => nameFor(person, userId, t)))}
        </li>
      ))}
    </ul>
  );
}
