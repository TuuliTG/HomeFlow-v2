import type { ReactNode } from 'react';

import type { Task, TaskRequest } from '@/features/tasks/task';
import { useAnswerTaskRequest, useCancelTaskRequest } from '@/features/tasks/useRequests';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskRequestPanelProps {
  task: Task;
  currentUserId: string;
}

/**
 * A request to do the task, if one is open: the member asked accepts or declines it, whoever asked can
 * cancel it or, once declined, dismiss the answer, and the rest of the household sees who was asked.
 */
export function TaskRequestPanel({ task, currentUserId }: TaskRequestPanelProps) {
  const { request } = task;
  if (!request || request.answer === 'accepted') return null;
  if (request.answer === null && request.requestedFor === currentUserId) {
    return <AnswerRequest task={task} request={request} currentUserId={currentUserId} />;
  }
  if (request.requestedBy === currentUserId) {
    return <OwnRequest task={task} request={request} currentUserId={currentUserId} />;
  }
  // Only whoever asked needs to hear that the answer was no.
  if (request.answer === 'declined') return null;
  return <OthersRequest request={request} />;
}

interface RequestProps {
  task: Task;
  request: TaskRequest;
  currentUserId: string;
}

function AnswerRequest({ task, request, currentUserId }: RequestProps) {
  const answer = useAnswerTaskRequest(currentUserId);
  const { common, tasks } = useMessages();
  const t = tasks.requests;
  return (
    <Notice
      tone="asked"
      text={t.askedYou(request.requesterName ?? common.someone)}
      failure={answer.isError ? t.answerFailed : null}
    >
      <NoticeButton
        label={t.decline}
        ariaLabel={t.declineLabel(task.title)}
        disabled={answer.isPending}
        onClick={() => {
          answer.mutate({ taskId: task.id, accept: false });
        }}
      />
      <NoticeButton
        label={t.accept}
        ariaLabel={t.acceptLabel(task.title)}
        disabled={answer.isPending}
        isPrimary
        onClick={() => {
          answer.mutate({ taskId: task.id, accept: true });
        }}
      />
    </Notice>
  );
}

/** The user's own request: waiting, which they can cancel, or declined, which they can dismiss. */
function OwnRequest({ task, request, currentUserId }: RequestProps) {
  const cancel = useCancelTaskRequest(currentUserId);
  const { common, tasks } = useMessages();
  const t = tasks.requests;
  const name = request.askedName ?? common.someone;
  const isDeclined = request.answer === 'declined';
  return (
    <Notice
      tone={isDeclined ? 'declined' : 'waiting'}
      text={isDeclined ? t.declined(name) : t.youAsked(name)}
      failure={cancel.isError ? t.cancelFailed : null}
    >
      <NoticeButton
        label={isDeclined ? t.dismiss : t.cancel}
        ariaLabel={isDeclined ? t.dismissLabel(task.title) : t.cancelLabel(task.title)}
        disabled={cancel.isPending}
        onClick={() => {
          cancel.mutate(task.id);
        }}
      />
    </Notice>
  );
}

function OthersRequest({ request }: { request: TaskRequest }) {
  const { common, tasks } = useMessages();
  return (
    <Notice
      tone="waiting"
      text={tasks.requests.asked(
        request.requesterName ?? common.someone,
        request.askedName ?? common.someone,
      )}
    />
  );
}

const toneClassNames = {
  asked: 'bg-brand-50 text-brand-900',
  waiting: 'bg-slate-50 text-slate-700',
  declined: 'bg-amber-50 text-amber-900',
} as const;

interface NoticeProps {
  tone: keyof typeof toneClassNames;
  text: string;
  failure?: string | null;
  children?: ReactNode;
}

function Notice({ tone, text, failure = null, children }: NoticeProps) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl p-3 text-sm ${toneClassNames[tone]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>{text}</p>
        {children && <div className="flex gap-2">{children}</div>}
      </div>
      {failure && (
        <p role="alert" className="text-xs text-red-700">
          {failure}
        </p>
      )}
    </div>
  );
}

interface NoticeButtonProps {
  label: string;
  ariaLabel: string;
  disabled: boolean;
  isPrimary?: boolean;
  onClick: () => void;
}

function NoticeButton({
  label,
  ariaLabel,
  disabled,
  isPrimary = false,
  onClick,
}: NoticeButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={
        isPrimary
          ? 'bg-brand-600 hover:bg-brand-900 rounded-lg px-3 py-1.5 font-semibold text-white disabled:opacity-60'
          : 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60'
      }
    >
      {label}
    </button>
  );
}
