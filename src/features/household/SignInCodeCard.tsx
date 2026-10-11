import { useId } from 'react';

import type { SignInCode } from '@/features/household/household';
import { useMessages } from '@/lib/i18n/i18n';

interface SignInCodeCardProps {
  childName: string;
  signInCode: SignInCode;
}

/** "KX7P29QF" as "KX7P-29QF", easier to read out. */
function readable(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** A child's one-time sign-in code, for an adult to give them, with how and until when to use it. */
export function SignInCodeCard({ childName, signInCode }: SignInCodeCardProps) {
  const headingId = useId();
  const t = useMessages();
  const copy = t.household.signInCode;
  return (
    <section
      aria-labelledby={headingId}
      className="bg-brand-50 flex flex-col gap-2 rounded-2xl border border-indigo-200 p-4"
    >
      <h3 id={headingId} className="font-semibold text-slate-900">
        {copy.heading(childName)}
      </h3>
      <p className="text-brand-900 font-mono text-2xl font-bold tracking-widest">
        {readable(signInCode.code)}
      </p>
      <p className="text-sm text-slate-700">{copy.howTo(childName)}</p>
      <p className="text-sm text-slate-700">
        {copy.expires(t.common.time(new Date(signInCode.expiresAt)))}
      </p>
    </section>
  );
}
