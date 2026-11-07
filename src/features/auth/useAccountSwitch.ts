import { useState } from 'react';

import { AccountSignedOutError } from '@/features/auth/accountSwitching';
import { useAuth } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * Switching to another account signed in on this device, and what went wrong if it failed. Kept by the
 * screen around the buttons, so the failure still shows once a forgotten account's button is gone.
 */
export function useAccountSwitch() {
  const { switchAccount } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const t = useMessages().auth.switchAccount;

  async function switchTo(userId: string, name: string) {
    setSwitching(true);
    setFailure(null);
    try {
      // On success the app starts afresh as that account.
      await switchAccount(userId);
    } catch (error) {
      setFailure(error instanceof AccountSignedOutError ? t.signedOut(name) : t.failed(name));
      setSwitching(false);
    }
  }

  return { switchTo, switching, failure };
}
