import { useMutation } from '@tanstack/react-query';
import { type SyntheticEvent, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { createAccount, logIn } from '@/features/auth/api';
import { LoginError, type LoginFailureReason } from '@/features/auth/loginError';
import { emailSchema, PASSWORD_MIN_LENGTH, passwordSchema } from '@/features/auth/validation';

const errorId = 'login-error';

type Mode = 'log-in' | 'create-account';

const failureMessages: Record<LoginFailureReason, string> = {
  'wrong-credentials': 'Wrong email or password.',
  'account-exists': 'There is already an account with this email. Log in instead.',
  'weak-password': `Choose a stronger password: at least ${PASSWORD_MIN_LENGTH} characters.`,
  'needs-email-confirmation':
    'HomeFlow is set up to confirm emails, which it can’t send yet. Ask the person who runs HomeFlow to turn off “Confirm email” in Supabase.',
  other: "That didn't work. Check your connection and try again.",
};

const copy: Record<Mode, { submit: string; switchPrompt: string; switchLabel: string }> = {
  'log-in': {
    submit: 'Log in',
    switchPrompt: 'New to HomeFlow?',
    switchLabel: 'Create an account',
  },
  'create-account': {
    submit: 'Create account',
    switchPrompt: 'Already have an account?',
    switchLabel: 'Log in instead',
  },
};

/** Log in with email and password, or create an account (ADR 0012). */
export function PasswordForm() {
  const [mode, setMode] = useState<Mode>('log-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      mode === 'log-in'
        ? logIn(input.email, input.password)
        : createAccount(input.email, input.password),
    onError: (submitError) => {
      setError(failureMessages[submitError instanceof LoginError ? submitError.reason : 'other']);
    },
  });

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const parsedEmail = emailSchema.safeParse(email.trim());
    if (!parsedEmail.success) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode === 'create-account' && !passwordSchema.safeParse(password).success) {
      setError(`Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`);
      return;
    }
    setError(null);
    submit.mutate({ email: parsedEmail.data, password });
  }

  function switchMode() {
    setMode(mode === 'log-in' ? 'create-account' : 'log-in');
    setError(null);
  }

  const fieldErrorProps = {
    'aria-invalid': error !== null,
    'aria-describedby': error ? errorId : undefined,
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Email
        <input
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          {...fieldErrorProps}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Password
        <input
          type="password"
          name="password"
          autoComplete={mode === 'log-in' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          {...fieldErrorProps}
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
        disabled={submit.isPending}
        className="bg-brand-600 hover:bg-brand-900 rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {copy[mode].submit}
      </button>
      {mode === 'create-account' && (
        <p className="text-xs text-slate-500">
          At least {PASSWORD_MIN_LENGTH} characters. Your browser or phone can save it for you.
        </p>
      )}
      <p className="text-center text-sm text-slate-600">
        {copy[mode].switchPrompt}{' '}
        <button type="button" onClick={switchMode} className="text-brand-600 font-medium underline">
          {copy[mode].switchLabel}
        </button>
      </p>
    </form>
  );
}
