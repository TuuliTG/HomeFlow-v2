import type { useAccountSwitch } from '@/features/auth/useAccountSwitch';
import { useAuth } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

interface DeviceAccountButtonsProps {
  switcher: ReturnType<typeof useAccountSwitch>;
  /** What each button says, e.g. "Switch to Ben". */
  label: (name: string) => string;
}

/** A button for each other account signed in on this device, with what went wrong if switching failed. */
export function DeviceAccountButtons({ switcher, label }: DeviceAccountButtonsProps) {
  const { otherAccounts } = useAuth();
  const { someone } = useMessages().common;
  const { switchTo, switching, failure } = switcher;

  return (
    <>
      {otherAccounts.map((account) => {
        const name = account.displayName || someone;
        return (
          <button
            key={account.userId}
            type="button"
            disabled={switching}
            onClick={() => void switchTo(account.userId, name)}
            className="bg-brand-600 hover:bg-brand-700 min-h-11 rounded-xl px-3 py-2 text-left font-medium text-white disabled:opacity-60"
          >
            {label(name)}
          </button>
        );
      })}
      {failure && (
        <p role="alert" className="text-danger-700 text-sm">
          {failure}
        </p>
      )}
    </>
  );
}
