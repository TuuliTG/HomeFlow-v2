import { useState } from 'react';

interface InviteCodeProps {
  code: string;
}

type CopyStatus = 'idle' | 'copied' | 'failed';

const copyMessages: Record<CopyStatus, string> = {
  idle: '',
  copied: 'Copied',
  failed: "Couldn't copy. Select the code instead.",
};

/** The household's invite code, with a button to copy it for sharing in a message. */
export function InviteCode({ code }: InviteCodeProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');

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
        Invite your family
      </h2>
      <p className="text-sm text-slate-600">
        Share this code with your family. They enter it after logging in to join your household.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-brand-900 font-mono text-2xl font-semibold tracking-widest select-all">
          {code}
        </p>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Copy code
        </button>
        <span role="status" className="text-sm text-slate-600">
          {copyMessages[copyStatus]}
        </span>
      </div>
    </section>
  );
}
