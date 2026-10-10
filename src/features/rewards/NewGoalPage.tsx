import { type SyntheticEvent, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { paths } from '@/app/paths';
import { CancelLink } from '@/components/ui/CancelLink';
import { inputClassName } from '@/components/ui/formStyles';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import {
  GOAL_TITLE_MAX_LENGTH,
  type GoalScope,
  goalScopeLabels,
  goalScopes,
  MAX_TARGET_POINTS,
  newGoalSchema,
} from '@/features/rewards/goal';
import { useAddGoal } from '@/features/rewards/useGoals';
import { useLoggedInUser } from '@/lib/auth';

const DEFAULT_TARGET_POINTS = '20';

const scopeHints: Record<GoalScope, string> = {
  shared: "Everyone's points count towards it, and the whole family sees it.",
  personal: 'Only your points count towards it. The family sees it too and can cheer you on.',
};

type FieldName = 'title' | 'targetPoints' | 'minPointsPerMember';

interface FormError {
  /** The field to fix, or null when saving failed. */
  field: FieldName | null;
  message: string;
}

function fieldOf(path: PropertyKey | undefined): FieldName {
  return path === 'targetPoints' || path === 'minPointsPerMember' ? path : 'title';
}

export function NewGoalPage() {
  const user = useLoggedInUser();
  const addGoal = useAddGoal(user.id);
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [targetPoints, setTargetPoints] = useState(DEFAULT_TARGET_POINTS);
  const [scope, setScope] = useState<GoalScope>('shared');
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
    const parsed = newGoalSchema.safeParse({
      title,
      targetPoints,
      scope,
      minPointsPerMember:
        scope === 'shared' && minPointsPerMember !== '' ? Number(minPointsPerMember) : null,
    });
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      const field = fieldOf(issue?.path[0]);
      setError({ field, message: issue?.message ?? 'Check the goal details.' });
      fieldRefs[field].current?.focus();
      return;
    }
    addGoal
      .mutateAsync(parsed.data)
      .then(() => navigate(paths.rewards))
      .catch(() => {
        setError({ field: null, message: "We couldn't save the goal. Try again." });
      });
  }

  return (
    <>
      <PageHeader
        eyebrow="Rewards"
        title="New goal"
        description="Pick a reward and how many points reach it."
      />
      <form
        onSubmit={handleSubmit}
        onChange={() => {
          setError(null);
        }}
        className="flex flex-col gap-5"
        noValidate
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Reward
          <input
            type="text"
            name="title"
            ref={titleRef}
            {...errorPropsFor('title')}
            maxLength={GOAL_TITLE_MAX_LENGTH}
            placeholder="e.g. Pizza night"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            className={inputClassName}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Points needed
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
            Who it&apos;s for
          </p>
          <SegmentedChoice
            legend="Who it's for"
            options={goalScopes}
            labels={goalScopeLabels}
            value={scope}
            onChange={setScope}
          />
          <p className="text-sm text-slate-600">{scopeHints[scope]}</p>
        </div>

        {scope === 'shared' && (
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Minimum points from each member (optional)
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
              The goal is reached only once everyone has earned at least this much, so nobody does
              it all alone.
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
            Set goal
          </button>
          <CancelLink fallback={paths.rewards} />
        </div>
      </form>
    </>
  );
}
