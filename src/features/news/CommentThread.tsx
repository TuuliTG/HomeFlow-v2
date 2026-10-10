import { type SyntheticEvent, useEffect, useId, useRef, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { COMMENT_MAX_LENGTH, nameFor, type NewsComment, type NewsItem } from '@/features/news/news';
import { useAddComment, useDeleteComment } from '@/features/news/useNews';

/** The comments on a done task, oldest first, and a form to add one. */
export function CommentThread({ item, userId }: { item: NewsItem; userId: string }) {
  const [isWriting, setIsWriting] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {item.comments.length > 0 && (
        <ul aria-label="Comments" className="flex flex-col gap-2">
          {item.comments.map((comment) => (
            <Comment key={comment.id} comment={comment} userId={userId} />
          ))}
        </ul>
      )}
      {isWriting ? (
        <CommentForm
          item={item}
          userId={userId}
          onDone={() => {
            setIsWriting(false);
          }}
        />
      ) : (
        <button
          type="button"
          aria-label={`Comment on ${item.title}`}
          onClick={() => {
            setIsWriting(true);
          }}
          className="text-brand-600 hover:text-brand-900 flex min-h-11 items-center self-start text-sm font-semibold"
        >
          Comment
        </button>
      )}
    </div>
  );
}

function Comment({ comment, userId }: { comment: NewsComment; userId: string }) {
  const deleteComment = useDeleteComment(userId);
  const isOwn = comment.author.userId === userId;
  return (
    <li className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 break-words text-slate-800">
          <span className="font-semibold">{nameFor(comment.author, userId)}</span> {comment.body}
        </p>
        {isOwn && (
          <button
            type="button"
            aria-label={`Delete your comment: ${comment.body}`}
            disabled={deleteComment.isPending}
            onClick={() => {
              deleteComment.mutate(comment.id);
            }}
            className="-my-1 shrink-0 rounded px-2 py-1 text-slate-500 hover:text-red-700 disabled:opacity-60"
          >
            Delete
          </button>
        )}
      </div>
      {deleteComment.isError && (
        <p role="alert" className="text-red-700">
          We couldn&apos;t delete your comment. Try again.
        </p>
      )}
    </li>
  );
}

function CommentForm({
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

  // The form opens when the user chooses Comment, so move them straight to the field.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (body.trim() === '') {
      setError('Write a comment first.');
      return;
    }
    setError(null);
    addComment.mutate(
      { taskId: item.taskId, body },
      {
        onSuccess: onDone,
        onError: () => {
          setError("We couldn't send your comment. Try again.");
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          aria-label={`Comment on ${item.title}`}
          placeholder="Say thanks or add a note"
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
          className="bg-brand-600 hover:bg-brand-900 shrink-0 rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          Send
        </button>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="self-start text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        Cancel
      </button>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
