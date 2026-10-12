import type { GoalParticipant, GoalSetter, NewParticipant } from '@/features/rewards/goal';

/** Whether a member takes part in a shared goal, and their minimum as typed ('' for none). */
export interface ParticipantChoice {
  takesPart: boolean;
  minPoints: string;
}

export type ParticipantChoices = Record<string, ParticipantChoice>;

/** Everyone takes part at first, without a minimum. */
export function everyoneTakingPart(members: GoalSetter[]): ParticipantChoices {
  return Object.fromEntries(members.map(({ id }) => [id, { takesPart: true, minPoints: '' }]));
}

/** The participants of a shared goal being changed, with their minimums. */
export function choicesOf(participants: GoalParticipant[]): ParticipantChoices {
  return Object.fromEntries(
    participants.map(({ id, minPoints }) => [
      id,
      { takesPart: true, minPoints: minPoints === null ? '' : String(minPoints) },
    ]),
  );
}

/** The members chosen to take part, in the order they joined, with their minimums. */
export function participantsOf(
  members: GoalSetter[],
  choices: ParticipantChoices,
): NewParticipant[] {
  return members.flatMap(({ id }) => {
    const choice = choices[id];
    if (!choice?.takesPart) return [];
    return [{ userId: id, minPoints: choice.minPoints === '' ? null : Number(choice.minPoints) }];
  });
}
