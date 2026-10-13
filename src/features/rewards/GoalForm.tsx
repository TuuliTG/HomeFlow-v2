import { type SyntheticEvent, useId, useState } from 'react';

import { paths } from '@/app/paths';
import { CancelLink } from '@/components/ui/CancelLink';
import { inputClassName } from '@/components/ui/formStyles';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import {
  GOAL_TITLE_MAX_LENGTH,
  type Goal,
  type GoalScope,
  goalScopes,
  type GoalSetter,
  MAX_TARGET_POINTS,
  type MembersWithOpenGoal,
  type NewGoal,
  newGoalSchema,
  type NewParticipant,
  OpenGoalExistsError,
} from '@/features/rewards/goal';
import {
  choicesOf,
  everyoneTakingPart,
  type ParticipantChoices,
  participantsOf,
} from '@/features/rewards/participantChoices';
import { GoalOwnerField } from '@/features/rewards/GoalOwnerField';
import { ParticipantsField } from '@/features/rewards/ParticipantsField';
import { useMessages } from '@/lib/i18n/i18n';

const DEFAULT_TARGET_POINTS = '20';

/**
 * A field to fix, named like its input: the reward, the points, who takes part, or one participant's
 * minimum (ParticipantsField).
 */
type FieldName = 'title' | 'targetPoints' | 'participants' | `minPoints:${string}`;

interface FormError {
  /** The field to fix, or null when saving failed. */
  field: FieldName | null;
  message: string;
}

/** The field a validation issue is about, e.g. ['participants', 1, 'minPoints'] for a minimum. */
function fieldOf(path: readonly PropertyKey[], participants: NewParticipant[]): FieldName {
  const [first, index] = path;
  if (first === 'targetPoints') return first;
  if (first !== 'participants') return 'title';
  const participant = typeof index === 'number' ? participants[index] : undefined;
  return participant ? `minPoints:${participant.userId}` : 'participants';
}

/** The form's inputs as typed. */
interface FormValues {
  title: string;
  targetPoints: string;
  scope: GoalScope;
  ownerId: string;
  choices: ParticipantChoices;
}

/** The members who can be chosen for each kind of goal: those without another open one (ADR 0007). */
interface FreeMembers {
  shared: GoalSetter[];
  personal: GoalSetter[];
}

/**
 * What the form starts with: the goal being changed, or a new goal shared by everyone free to take part,
 * or for the user (or else the first member free) as their own. A personal goal switched to shared
 * starts with everyone free to take part.
 */
function startingValues(initial: Goal | undefined, userId: string, free: FreeMembers): FormValues {
  const freeOwner = free.personal.find(({ id }) => id === userId) ?? free.personal[0];
  const ownerId = freeOwner?.id ?? userId;
  if (!initial) {
    return {
      title: '',
      targetPoints: DEFAULT_TARGET_POINTS,
      scope: 'shared',
      ownerId,
      choices: everyoneTakingPart(free.shared),
    };
  }
  const { title, targetPoints, owner, participants } = initial;
  return {
    title,
    targetPoints: String(targetPoints),
    scope: owner ? 'personal' : 'shared',
    ownerId: owner?.id ?? ownerId,
    choices: owner ? everyoneTakingPart(free.shared) : choicesOf(participants),
  };
}

interface GoalFormProps {
  userId: string;
  members: GoalSetter[];
  /** Who already has another open goal, so they can't be chosen for one of the same kind (ADR 0007). */
  busy: MembersWithOpenGoal;
  /** The open goal being changed; a new goal starts empty, shared by everyone free to take part. */
  initial?: Goal;
  submitLabel: string;
  isSaving: boolean;
  /** Saves the goal; a rejection shows that saving failed. */
  onSave: (goal: NewGoal) => Promise<unknown>;
}

/** The reward, the points that reach it and who it is for (ADR 0007). */
export function GoalForm({
  userId,
  members,
  busy,
  initial,
  submitLabel,
  isSaving,
  onSave,
}: GoalFormProps) {
  const messages = useMessages();
  const t = messages.rewards.form;
  const [start] = useState(() =>
    startingValues(initial, userId, {
      shared: members.filter(({ id }) => !busy.shared.has(id)),
      personal: members.filter(({ id }) => !busy.personal.has(id)),
    }),
  );
  const [title, setTitle] = useState(start.title);
  const [targetPoints, setTargetPoints] = useState(start.targetPoints);
  const [scope, setScope] = useState(start.scope);
  /** Whose personal goal it is; the user's own unless they pick another member. */
  const [ownerId, setOwnerId] = useState(start.ownerId);
  const [choices, setChoices] = useState(start.choices);
  const [error, setError] = useState<FormError | null>(null);
  const errorId = useId();

  function errorPropsFor(field: FieldName) {
    const hasError = error?.field === field;
    return { 'aria-invalid': hasError, 'aria-describedby': hasError ? errorId : undefined };
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const participants = scope === 'shared' ? participantsOf(members, choices) : [];
    const parsed = newGoalSchema(messages).safeParse({
      title,
      targetPoints,
      scope,
      ownerId: scope === 'personal' ? ownerId : null,
      participants,
    });
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      const field = fieldOf(issue?.path ?? [], participants);
      setError({ field, message: issue?.message ?? t.checkDetails });
      const input = event.currentTarget.elements.namedItem(field);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    onSave(parsed.data).catch((saveError: unknown) => {
      const message = saveError instanceof OpenGoalExistsError ? t.openGoalExists : t.saveFailed;
      setError({ field: null, message });
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

        {scope === 'personal' ? (
          <GoalOwnerField
            members={members}
            busy={busy.personal}
            userId={userId}
            value={ownerId}
            onChange={setOwnerId}
          />
        ) : (
          <ParticipantsField
            members={members}
            busy={busy.shared}
            userId={userId}
            choices={choices}
            onChange={setChoices}
            errorPropsFor={errorPropsFor}
          />
        )}

        {error && (
          <p id={errorId} role="alert" className="text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-brand-600 hover:bg-brand-900 flex-1 rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {submitLabel}
          </button>
          <CancelLink fallback={paths.rewards} />
        </div>
      </form>
    </>
  );
}
