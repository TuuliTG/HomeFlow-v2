import { useMutation } from '@tanstack/react-query';
import { type SyntheticEvent, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { createAccount, logIn } from '@/features/auth/api';
import { failureMessage, LoginError } from '@/features/auth/loginError';
import { emailSchema, PASSWORD_MIN_LENGTH, passwordSchema } from '@/features/auth/validation';
import { useMessages } from '@/lib/i18n/i18n';

const errorId = 'login-error';
const hintId = 'password-hint';

type Mode = 'log-in' | 'create-account';

/** Log in with email and password, or create an account (ADR 0003). */
export function PasswordForm() {
  const [mode, setMode] = useState<Mode>('log-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isCreating = mode === 'create-account';
  const t = useMessages();
  const copy = isCreating ? t.auth.createAccount : t.auth.logIn;

  const submit = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      mode === 'log-in'
        ? logIn(input.email, input.password)
        : createAccount(input.email, input.password),
    onError: (submitError) => {
      setError(failureMessage(submitError instanceof LoginError ? submitError.reason : 'other', t));
    },
  });

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const parsedEmail = emailSchema.safeParse(email.trim());
    if (!parsedEmail.success) {
      setError(t.auth.invalidEmail);
      return;
    }
    if (isCreating && !passwordSchema.safeParse(password).success) {
      setError(t.auth.shortPassword(PASSWORD_MIN_LENGTH));
      return;
    }
    setError(null);
    submit.mutate({ email: parsedEmail.data, password });
  }

  function switchMode() {
    setMode(mode === 'log-in' ? 'create-account' : 'log-in');
    setError(null);
  }

  const describedBy = (...ids: (string | false)[]) => ids.filter(Boolean).join(' ') || undefined;

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="login-form-heading"
      className="flex flex-col gap-4"
      noValidate
    >
      <h2 id="login-form-heading" className="text-ink font-semibold">
        {copy.heading}
      </h2>
      <label className="text-ink flex flex-col gap-1 text-sm font-medium">
        {t.auth.email}
        <input
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          aria-invalid={error !== null}
          aria-describedby={describedBy(error !== null && errorId)}
          className={inputClassName}
        />
      </label>
      <div className="flex flex-col gap-1">
        <label className="text-ink flex flex-col gap-1 text-sm font-medium">
          {t.auth.password}
          <input
            type="password"
            name="password"
            autoComplete={mode === 'log-in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            aria-invalid={error !== null}
            aria-describedby={describedBy(isCreating && hintId, error !== null && errorId)}
            className={inputClassName}
          />
        </label>
        {isCreating && (
          <p id={hintId} className="text-ink-muted text-xs">
            {t.auth.passwordHint(PASSWORD_MIN_LENGTH)}
          </p>
        )}
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
        {copy.submit}
      </button>
      <p className="text-ink-muted text-center text-sm">
        {copy.switchPrompt}{' '}
        <button type="button" onClick={switchMode} className="text-brand-600 font-medium underline">
          {copy.switchLabel}
        </button>
      </p>
    </form>
  );
}
