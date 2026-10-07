import { useMutation } from '@tanstack/react-query';
import { type SyntheticEvent, useEffect, useRef, useState } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { sendLoginCode, verifyLoginCode } from '@/features/auth/api';
import { emailSchema, loginCodeSchema } from '@/features/auth/validation';

const errorId = 'login-error';
const primaryButtonClassName =
  'bg-brand-600 hover:bg-brand-900 rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60';

type FormSubmit = SyntheticEvent<HTMLFormElement, SubmitEvent>;

/** Passwordless login: ask for an email, then for the code that was emailed to it. */
export function EmailCodeForm() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // The "Send code" button disappears with the email step; keep keyboard focus in the form.
  useEffect(() => {
    if (codeSent) codeInputRef.current?.focus();
  }, [codeSent]);

  const sendCode = useMutation({
    mutationFn: sendLoginCode,
    onSuccess: () => {
      setCodeSent(true);
    },
    onError: () => {
      setError("We couldn't send the code. Wait a moment and try again.");
    },
  });
  const verifyCode = useMutation({
    mutationFn: (input: { email: string; code: string }) =>
      verifyLoginCode(input.email, input.code),
    onError: () => {
      setError("That code didn't work. Check the latest email, or send a new code.");
    },
  });

  function handleSendCode(event: FormSubmit) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    setError(parsed.success ? null : 'Enter a valid email address.');
    if (parsed.success) sendCode.mutate(parsed.data);
  }

  function handleVerifyCode(event: FormSubmit) {
    event.preventDefault();
    const parsed = loginCodeSchema.safeParse(code.trim());
    setError(parsed.success ? null : 'Enter the code from the email.');
    if (parsed.success) verifyCode.mutate({ email: email.trim(), code: parsed.data });
  }

  function useDifferentEmail() {
    setCodeSent(false);
    setCode('');
    setError(null);
  }

  const errorMessage = error && (
    <p id={errorId} role="alert" className="text-sm text-red-700">
      {error}
    </p>
  );

  if (!codeSent) {
    return (
      <form onSubmit={handleSendCode} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            className={inputClassName}
          />
        </label>
        {errorMessage}
        <button type="submit" disabled={sendCode.isPending} className={primaryButtonClassName}>
          Send code
        </button>
        <p className="text-xs text-slate-500">
          No password needed. We email you a one-time code; your account is created the first time
          you log in.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-slate-700">
        We sent a login code to <strong>{email.trim()}</strong>. It can take a minute to arrive.
      </p>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Login code
        <input
          ref={codeInputRef}
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={inputClassName}
        />
      </label>
      {errorMessage}
      <button type="submit" disabled={verifyCode.isPending} className={primaryButtonClassName}>
        Log in
      </button>
      <button
        type="button"
        onClick={useDifferentEmail}
        className="text-brand-600 text-sm font-medium underline"
      >
        Use a different email
      </button>
    </form>
  );
}
