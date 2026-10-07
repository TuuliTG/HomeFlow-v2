import { useState } from 'react';

import { SingleFieldForm } from '@/components/ui/SingleFieldForm';
import { UnknownInviteCodeError } from '@/features/household/household';
import { useCreateHousehold, useJoinHousehold } from '@/features/household/useHousehold';
import {
  HOUSEHOLD_NAME_MAX_LENGTH,
  householdNameSchema,
  inviteCodeSchema,
} from '@/features/household/validation';

interface FormProps {
  userId: string;
}

export function CreateHouseholdForm({ userId }: FormProps) {
  const [error, setError] = useState<string | null>(null);
  const create = useCreateHousehold(userId);

  function handleSubmit(name: string) {
    const parsed = householdNameSchema.safeParse(name);
    if (!parsed.success) {
      setError('Give your household a name.');
      return;
    }
    setError(null);
    create.mutate(parsed.data, {
      onError: () => {
        setError("We couldn't create the household. Try again.");
      },
    });
  }

  return (
    <SingleFieldForm
      label="Household name"
      submitLabel="Create household"
      inputProps={{
        name: 'household-name',
        autoComplete: 'off',
        maxLength: HOUSEHOLD_NAME_MAX_LENGTH,
        placeholder: 'e.g. The Virtanens',
      }}
      error={error}
      isPending={create.isPending}
      onSubmit={handleSubmit}
      hint="You'll get an invite code to share with your family."
    />
  );
}

export function JoinHouseholdForm({ userId }: FormProps) {
  const [error, setError] = useState<string | null>(null);
  const join = useJoinHousehold(userId);

  function handleSubmit(code: string) {
    const parsed = inviteCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError('Enter the 8-character invite code.');
      return;
    }
    setError(null);
    join.mutate(parsed.data, {
      onError: (joinError) => {
        setError(
          joinError instanceof UnknownInviteCodeError
            ? 'No household has this invite code. Check it with your family.'
            : "We couldn't join the household. Try again.",
        );
      },
    });
  }

  return (
    <SingleFieldForm
      label="Invite code"
      submitLabel="Join household"
      inputProps={{ name: 'invite-code', autoComplete: 'off', autoCapitalize: 'characters' }}
      error={error}
      isPending={join.isPending}
      onSubmit={handleSubmit}
    />
  );
}
