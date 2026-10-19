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
      className="bg-surface shadow-card flex flex-col gap-3 rounded-2xl p-4"
    >
      <h2 id="invite-code" className="text-ink font-semibold">
        {t.heading}
      </h2>
      <p className="text-ink-muted text-sm">{t.intro}</p>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-brand-900 font-mono text-2xl font-semibold tracking-widest select-all">
          {code}
        </p>
        <button
          type="button"
          onClick={copy}
          className="border-line-strong text-ink hover:bg-page rounded-lg border px-3 py-1.5 text-sm font-medium"
        >
          {t.copy}
        </button>
        <span role="status" className="text-ink-muted text-sm">
          {copyMessages[copyStatus]}
        </span>
      </div>
    </section>
  );
}
