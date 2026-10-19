import { useMutation } from '@tanstack/react-query';
import { type SyntheticEvent, useId, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { signInWithChildCode } from '@/features/auth/api';
import { failureMessage, LoginError } from '@/features/auth/loginError';
import { useMessages } from '@/lib/i18n/i18n';

/** Codes have 8 letters and digits; dashes and spaces don't count. */
const CODE_LENGTH = 8;

interface ChildCodeFormProps {
  /** Back to logging in with email and password. */
  onBack: () => void;
}

/** A child without email signs in with the one-time code an adult made for them (ADR 0003). */
export function ChildCodeForm({ onBack }: ChildCodeFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const t = useMessages();
  const headingId = useId();
  const hintId = useId();
  const errorId = useId();
  const submit = useMutation({
    mutationFn: signInWithChildCode,
    onError: (submitError) => {
      setError(failureMessage(submitError instanceof LoginError ? submitError.reason : 'other', t));
    },
  });

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (code.replace(/[^A-Za-z0-9]/g, '').length !== CODE_LENGTH) {
      setError(t.auth.childCode.invalid);
      return;
    }
    setError(null);
    submit.mutate(code);
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby={headingId}
      className="flex flex-col gap-4"
      noValidate
    >
      <h2 id={headingId} className="text-ink font-semibold">
        {t.auth.childCode.heading}
      </h2>
      <div className="flex flex-col gap-1">
        <label className="text-ink flex flex-col gap-1 text-sm font-medium">
          {t.auth.childCode.label}
          <input
            name="code"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
            }}
            aria-invalid={error !== null}
            aria-describedby={error === null ? hintId : `${hintId} ${errorId}`}
            className={`${inputClassName} font-mono tracking-widest uppercase`}
          />
        </label>
        <p id={hintId} className="text-ink-muted text-xs">
          {t.auth.childCode.hint}
        </p>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-danger-700 text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submit.isPending}
        className="bg-brand-700 hover:bg-brand-900 rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-60"
      >
        {t.auth.childCode.submit}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="text-brand-600 text-sm font-medium underline"
      >
        {t.auth.childCode.back}
      </button>
    </form>
  );
}
