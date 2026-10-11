import { useId } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { type GoalSetter, nameOf } from '@/features/rewards/goal';
import type { ParticipantChoice, ParticipantChoices } from '@/features/rewards/participantChoices';
import { useMessages } from '@/lib/i18n/i18n';

interface ParticipantsFieldProps {
  members: GoalSetter[];
  userId: string;
  choices: ParticipantChoices;
  onChange: (choices: ParticipantChoices) => void;
  /** Marks a field the user has to fix, by its input's name. */
  errorPropsFor: (field: 'participants' | `minPoints:${string}`) => {
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  };
}

/**
 * Who takes part in a shared goal, each with an optional minimum, so e.g. a younger child can share a
 * goal with a big sister and do less.
 */
export function ParticipantsField({
  members,
  userId,
  choices,
  onChange,
  errorPropsFor,
}: ParticipantsFieldProps) {
  const messages = useMessages();
  const t = messages.rewards.form;
  const hintId = useId();

  function update(memberId: string, change: Partial<ParticipantChoice>) {
    const choice = choices[memberId] ?? { takesPart: false, minPoints: '' };
    onChange({ ...choices, [memberId]: { ...choice, ...change } });
  }

  return (
    <fieldset aria-describedby={hintId} className="flex flex-col gap-1">
      <legend className="text-sm font-medium text-slate-700">{t.participants}</legend>
      <p id={hintId} className="text-sm text-slate-600">
        {t.participantsHint}
      </p>
      <ul className="flex flex-col divide-y divide-slate-200">
        {members.map((member, index) => {
          const name = member.id === userId ? t.me : nameOf(member, messages);
          const choice = choices[member.id];
          const minimumField = `minPoints:${member.id}` as const;
          return (
            <li key={member.id} className="flex min-h-14 items-center justify-between gap-3">
              <label className="flex min-h-11 flex-1 items-center gap-3 text-base text-slate-900">
                <input
                  type="checkbox"
                  // The first box stands for the whole field when nobody takes part.
                  name={index === 0 ? 'participants' : undefined}
                  {...(index === 0 ? errorPropsFor('participants') : {})}
                  checked={choice?.takesPart ?? false}
                  onChange={(event) => {
                    update(member.id, { takesPart: event.target.checked });
                  }}
                  className="accent-brand-600 size-5"
                />
                {name}
              </label>
              {choice?.takesPart && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  {t.minimum}
                  <input
                    type="number"
                    name={minimumField}
                    {...errorPropsFor(minimumField)}
                    aria-label={t.minimumFor(name)}
                    inputMode="numeric"
                    min={1}
                    value={choice.minPoints}
                    onChange={(event) => {
                      update(member.id, { minPoints: event.target.value });
                    }}
                    className={`${inputClassName} w-20`}
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
