import { useState } from 'react';

import { useMessages } from '@/lib/i18n/i18n';

interface InviteCodeProps {
  code: string;
}

type CopyStatus = 'idle' | 'copied' | 'failed';

/** The household's invite code, with a button to copy it for sharing in a message. */
export function InviteCode({ code }: InviteCodeProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const t = useMessages().household.invite;
  const copyMessages: Record<CopyStatus, string> = {
    idle: '',
    copied: t.copied,
    failed: t.copyFailed,
  };

  function copy() {
    setCopyStatus('idle');
    // The Clipboard API is missing outside secure contexts (e.g. testing over plain http on a LAN).
    if (!('clipboard' in navigator)) {
      setCopyStatus('failed');
      return;
    }
    navigator.clipboard.writeText(code).then(
      () => {
        setCopyStatus('copied');
      },
      () => {
        setCopyStatus('failed');
      },
    );
  }

  return (
    <section
      aria-labelledby="invite-code"
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <h2 id="invite-code" className="font-semibold text-slate-900">
        {t.heading}
      </h2>
      <p className="text-sm text-slate-600">{t.intro}</p>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-brand-900 font-mono text-2xl font-semibold tracking-widest select-all">
          {code}
        </p>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          {t.copy}
        </button>
        <span role="status" className="text-sm text-slate-600">
          {copyMessages[copyStatus]}
        </span>
      </div>
    </section>
  );
}
