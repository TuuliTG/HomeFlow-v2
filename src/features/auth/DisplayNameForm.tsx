import { useState } from 'react';

import { SingleFieldForm } from '@/components/ui/SingleFieldForm';
import { useSaveOwnProfile } from '@/features/auth/useOwnProfile';
import { DISPLAY_NAME_MAX_LENGTH, displayNameSchema } from '@/features/auth/validation';
import { useMessages } from '@/lib/i18n/i18n';

interface DisplayNameFormProps {
  userId: string;
}

/** First-login step: the only personal detail we store besides the email is this name. */
export function DisplayNameForm({ userId }: DisplayNameFormProps) {
  const [error, setError] = useState<string | null>(null);
  const saveProfile = useSaveOwnProfile(userId);
  const t = useMessages();

  function handleSubmit(name: string) {
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(t.auth.enterName);
      return;
    }
    setError(null);
    saveProfile.mutate(parsed.data, {
      onError: () => {
        setError(t.auth.nameNotSaved);
      },
    });
  }

  return (
    <SingleFieldForm
      label={t.auth.yourName}
      submitLabel={t.common.save}
      inputProps={{ name: 'name', autoComplete: 'given-name', maxLength: DISPLAY_NAME_MAX_LENGTH }}
      error={error}
      isPending={saveProfile.isPending}
      onSubmit={handleSubmit}
    />
  );
}
