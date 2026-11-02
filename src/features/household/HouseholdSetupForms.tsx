import { useState } from 'react';

import { SingleFieldForm } from '@/components/ui/SingleFieldForm';
import { UnknownInviteCodeError } from '@/features/household/household';
import { useCreateHousehold, useJoinHousehold } from '@/features/household/useHousehold';
import {
  HOUSEHOLD_NAME_MAX_LENGTH,
  householdNameSchema,
  inviteCodeSchema,
} from '@/features/household/validation';
import { useMessages } from '@/lib/i18n/i18n';

interface FormProps {
  userId: string;
}

export function CreateHouseholdForm({ userId }: FormProps) {
  const [error, setError] = useState<string | null>(null);
  const create = useCreateHousehold(userId);
  const t = useMessages().household.create;

  function handleSubmit(name: string) {
    const parsed = householdNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(t.nameRequired);
      return;
    }
    setError(null);
    create.mutate(parsed.data, {
      onError: () => {
        setError(t.failed);
      },
    });
  }

  return (
    <SingleFieldForm
      label={t.label}
      submitLabel={t.submit}
      inputProps={{
        name: 'household-name',
        autoComplete: 'off',
        maxLength: HOUSEHOLD_NAME_MAX_LENGTH,
        placeholder: t.placeholder,
      }}
      error={error}
      isPending={create.isPending}
      onSubmit={handleSubmit}
    />
  );
}

export function JoinHouseholdForm({ userId }: FormProps) {
  const [error, setError] = useState<string | null>(null);
  const join = useJoinHousehold(userId);
  const t = useMessages().household.join;

  function handleSubmit(code: string) {
    const parsed = inviteCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(t.invalidCode);
      return;
    }
    setError(null);
    join.mutate(parsed.data, {
      onError: (joinError) => {
        setError(joinError instanceof UnknownInviteCodeError ? t.unknownCode : t.failed);
      },
    });
  }

  return (
    <SingleFieldForm
      label={t.label}
      submitLabel={t.submit}
      inputProps={{ name: 'invite-code', autoComplete: 'off', autoCapitalize: 'characters' }}
      error={error}
      isPending={join.isPending}
      onSubmit={handleSubmit}
    />
  );
}
