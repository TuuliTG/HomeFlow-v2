import { type SyntheticEvent, useEffect, useId, useRef, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { COMMENT_MAX_LENGTH, nameFor, type NewsComment, type NewsItem } from '@/features/news/news';
import { useAddComment, useDeleteComment } from '@/features/news/useNews';
import { useMessages } from '@/lib/i18n/i18n';

/** The comments on a done task, oldest first. */
export function CommentList({ item, userId }: { item: NewsItem; userId: string }) {
  const t = useMessages().news;
  if (item.comments.length === 0) return null;
  return (
    <ul aria-label={t.comments} className="flex flex-col gap-2">
      {item.comments.map((comment) => (
        <Comment key={comment.id} comment={comment} userId={userId} />
      ))}
    </ul>
  );
}

function Comment({ comment, userId }: { comment: NewsComment; userId: string }) {
  const deleteComment = useDeleteComment(userId);
  const isOwn = comment.author.userId === userId;
  const t = useMessages();
  const name = nameFor(comment.author, userId, t);
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        aria-hidden="true"
        className="bg-brand-100 text-brand-900 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
      >
        {Array.from(name)[0]?.toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="bg-page flex items-start justify-between gap-2 rounded-2xl rounded-tl-md px-3 py-2">
          <p className="text-ink min-w-0 break-words">
            <span className="block font-semibold">{name}</span> {comment.body}
          </p>
          {isOwn && (
            <button
              type="button"
              aria-label={t.news.deleteLabel(comment.body)}
              disabled={deleteComment.isPending}
              onClick={() => {
                deleteComment.mutate(comment.id);
              }}
              className="text-ink-muted hover:text-danger-700 -my-1 -mr-1 shrink-0 rounded px-2 py-1 text-xs font-semibold disabled:opacity-60"
            >
              {t.common.delete}
            </button>
          )}
        </div>
        {deleteComment.isError && (
          <p role="alert" className="text-danger-700">
            {t.news.deleteFailed}
          </p>
        )}
      </div>
    </li>
  );
}

/** A form to comment on a done task; `onDone` closes it, after sending or on Cancel. */
export function CommentForm({
  item,
  userId,
  onDone,
}: {
  item: NewsItem;
  userId: string;
  onDone: () => void;
}) {
  const addComment = useAddComment(userId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useMessages();

  // The form opens when the user chooses Comment, so move them straight to the field.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (body.trim() === '') {
      setError(t.news.writeFirst);
      return;
    }
    setError(null);
    addComment.mutate(
      { taskId: item.taskId, body },
      {
        onSuccess: onDone,
        onError: () => {
          setError(t.news.sendFailed);
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          aria-label={t.news.commentOn(item.title)}
          placeholder={t.news.commentPlaceholder}
          maxLength={COMMENT_MAX_LENGTH}
          ref={inputRef}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={`${inputClassName} min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={addComment.isPending}
          className="bg-brand-700 hover:bg-brand-900 shrink-0 rounded-xl px-4 py-2 font-bold text-white disabled:opacity-60"
        >
          {t.news.send}
        </button>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="text-ink-muted hover:text-ink self-start text-sm font-semibold"
      >
        {t.common.cancel}
      </button>
      {error && (
        <p id={errorId} role="alert" className="text-danger-700 text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
