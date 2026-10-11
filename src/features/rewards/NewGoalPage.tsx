import { type SyntheticEvent, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { paths } from '@/app/paths';
import { CancelLink } from '@/components/ui/CancelLink';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { inputClassName } from '@/components/ui/formStyles';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import {
  GOAL_TITLE_MAX_LENGTH,
  type GoalScope,
  goalScopes,
  type GoalSetter,
  MAX_TARGET_POINTS,
  nameOf,
  newGoalSchema,
} from '@/features/rewards/goal';
import { useAddGoal, useGoalSetters } from '@/features/rewards/useGoals';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

const DEFAULT_TARGET_POINTS = '20';

type FieldName = 'title' | 'targetPoints' | 'minPointsPerMember';

interface FormError {
  /** The field to fix, or null when saving failed. */
  field: FieldName | null;
  message: string;
}

function fieldOf(path: PropertyKey | undefined): FieldName {
  return path === 'targetPoints' || path === 'minPointsPerMember' ? path : 'title';
}

/** Only adults set goals, for the family or for one member (ADR 0007). */
export function NewGoalPage() {
  const user = useLoggedInUser();
  const setters = useGoalSetters(user.id);
  const messages = useMessages();

  return (
    <>
      <PageHeader
        eyebrow={messages.rewards.eyebrow}
        title={messages.rewards.newGoal}
        description={messages.rewards.form.description}
      />
      {setters.isPending ? (
        <LoadingMessage />
      ) : setters.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {messages.rewards.loadFailed}
        </p>
      ) : setters.isAdult ? (
        <NewGoalForm userId={user.id} members={setters.data} />
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          {messages.rewards.form.onlyAdults}
        </p>
      )}
    </>
  );
}

function NewGoalForm({ userId, members }: { userId: string; members: GoalSetter[] }) {
  const addGoal = useAddGoal(userId);
  const navigate = useNavigate();
  const messages = useMessages();
  const t = messages.rewards.form;
  const [title, setTitle] = useState('');
  const [targetPoints, setTargetPoints] = useState(DEFAULT_TARGET_POINTS);
  const [scope, setScope] = useState<GoalScope>('shared');
  /** Whose personal goal it is; the user's own unless they pick another member. */
  const [ownerId, setOwnerId] = useState(userId);
  /** Points each member must earn towards a family goal, or '' for no minimum. */
  const [minPointsPerMember, setMinPointsPerMember] = useState('');
  const [error, setError] = useState<FormError | null>(null);
  const errorId = useId();
  const minimumHintId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const targetPointsRef = useRef<HTMLInputElement>(null);
  const minimumRef = useRef<HTMLInputElement>(null);
  const fieldRefs = {
    title: titleRef,
    targetPoints: targetPointsRef,
    minPointsPerMember: minimumRef,
  };

  function errorPropsFor(field: FieldName) {
    const hasError = error?.field === field;
    return { 'aria-invalid': hasError, 'aria-describedby': hasError ? errorId : undefined };
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const parsed = newGoalSchema(messages).safeParse({
      title,
      targetPoints,
      scope,
      ownerId: scope === 'personal' ? ownerId : null,
      minPointsPerMember:
        scope === 'shared' && minPointsPerMember !== '' ? Number(minPointsPerMember) : null,
    });
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      const field = fieldOf(issue?.path[0]);
      setError({ field, message: issue?.message ?? t.checkDetails });
      fieldRefs[field].current?.focus();
      return;
    }
    addGoal
      .mutateAsync(parsed.data)
      .then(() => navigate(paths.rewards))
      .catch(() => {
        setError({ field: null, message: t.saveFailed });
      });
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        onChange={() => {
          setError(null);
        }}
        className="flex flex-col gap-5"
        noValidate
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          {t.reward}
          <input
            type="text"
            name="title"
            ref={titleRef}
            {...errorPropsFor('title')}
            maxLength={GOAL_TITLE_MAX_LENGTH}
            placeholder={t.rewardPlaceholder}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            className={inputClassName}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          {t.pointsNeeded}
          <input
            type="number"
            name="targetPoints"
            ref={targetPointsRef}
            {...errorPropsFor('targetPoints')}
            inputMode="numeric"
            min={1}
            max={MAX_TARGET_POINTS}
            value={targetPoints}
            onChange={(event) => {
              setTargetPoints(event.target.value);
            }}
            className={`${inputClassName} w-28`}
          />
        </label>

        <div className="flex flex-col gap-1">
          <p aria-hidden="true" className="text-sm font-medium text-slate-700">
            {t.whoFor}
          </p>
          <SegmentedChoice
            legend={t.whoFor}
            options={goalScopes}
            labels={t.scopes}
            value={scope}
            onChange={setScope}
          />
          <p className="text-sm text-slate-600">{t.scopeHints[scope]}</p>
        </div>

        {scope === 'personal' && (
          <GoalOwnerField members={members} userId={userId} value={ownerId} onChange={setOwnerId} />
        )}

        {scope === 'shared' && (
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            {t.minimum}
            <input
              type="number"
              name="minPointsPerMember"
              ref={minimumRef}
              {...errorPropsFor('minPointsPerMember')}
              aria-describedby={
                error?.field === 'minPointsPerMember'
                  ? `${errorId} ${minimumHintId}`
                  : minimumHintId
              }
              inputMode="numeric"
              min={1}
              value={minPointsPerMember}
              onChange={(event) => {
                setMinPointsPerMember(event.target.value);
              }}
              className={`${inputClassName} w-28`}
            />
            <span id={minimumHintId} className="font-normal text-slate-600">
              {t.minimumHint}
            </span>
          </label>
        )}

        {error && (
          <p id={errorId} role="alert" className="text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={addGoal.isPending}
            className="bg-brand-600 hover:bg-brand-900 flex-1 rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {t.submit}
          </button>
          <CancelLink fallback={paths.rewards} />
        </div>
      </form>
    </>
  );
}

interface GoalOwnerFieldProps {
  members: GoalSetter[];
  userId: string;
  value: string;
  onChange: (ownerId: string) => void;
}

/** Whose personal goal it is: the user's own ("Me") or another member's, e.g. a child's. */
function GoalOwnerField({ members, userId, value, onChange }: GoalOwnerFieldProps) {
  const messages = useMessages();
  const t = messages.rewards.form;
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {t.whose}
      <select
        name="ownerId"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={`${inputClassName} w-fit`}
      >
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.id === userId ? t.me : nameOf(member, messages)}
          </option>
        ))}
      </select>
    </label>
  );
}
