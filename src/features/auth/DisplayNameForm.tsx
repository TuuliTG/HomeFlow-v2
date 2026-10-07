import { useState } from 'react';

import { SingleFieldForm } from '@/components/ui/SingleFieldForm';
import { useSaveOwnProfile } from '@/features/auth/useOwnProfile';
import { DISPLAY_NAME_MAX_LENGTH, displayNameSchema } from '@/features/auth/validation';

interface DisplayNameFormProps {
  userId: string;
}

/** First-login step: the only personal detail we store besides the email is this name. */
export function DisplayNameForm({ userId }: DisplayNameFormProps) {
  const [error, setError] = useState<string | null>(null);
  const saveProfile = useSaveOwnProfile(userId);

  function handleSubmit(name: string) {
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) {
      setError('Enter your name.');
      return;
    }
    setError(null);
    saveProfile.mutate(parsed.data, {
      onError: () => {
        setError("We couldn't save your name. Try again.");
      },
    });
  }

  return (
    <SingleFieldForm
      label="Your name"
      submitLabel="Save"
      inputProps={{ name: 'name', autoComplete: 'given-name', maxLength: DISPLAY_NAME_MAX_LENGTH }}
      error={error}
      isPending={saveProfile.isPending}
      onSubmit={handleSubmit}
      hint="This is how your family will see you in HomeFlow."
    />
  );
}
