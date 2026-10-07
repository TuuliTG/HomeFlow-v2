import { type SyntheticEvent, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { useSaveOwnProfile } from '@/features/auth/useOwnProfile';
import { DISPLAY_NAME_MAX_LENGTH, displayNameSchema } from '@/features/auth/validation';

const errorId = 'display-name-error';

interface DisplayNameFormProps {
  userId: string;
}

/** First-login step: the only personal detail we store besides the email is this name. */
export function DisplayNameForm({ userId }: DisplayNameFormProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const saveProfile = useSaveOwnProfile(userId);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Your name
        <input
          type="text"
          name="name"
          autoComplete="given-name"
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={inputClassName}
        />
      </label>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={saveProfile.isPending}
        className="bg-brand-600 hover:bg-brand-900 rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        Save
      </button>
      <p className="text-xs text-slate-500">This is how your family will see you in HomeFlow.</p>
    </form>
  );
}
