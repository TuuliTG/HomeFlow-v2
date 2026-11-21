import { useState } from 'react';

import { Switch } from '@/components/ui/Switch';

interface SavingSwitchProps {
  label: string;
  checked: boolean;
  disabled: boolean;
  /** Saves the choice, settling once the saved value has loaded (a failure shows elsewhere). */
  onChange: (checked: boolean) => Promise<void>;
}

/**
 * A setting's switch across its row, whose new value shows straight away and the saved one again once saving
 * settles.
 */
export function SavingSwitch({ label, checked, disabled, onChange }: SavingSwitchProps) {
  /** The choice being saved; null once the saved one has loaded. */
  const [saving, setSaving] = useState<boolean | null>(null);
  return (
    <Switch
      wide
      label={label}
      checked={saving ?? checked}
      disabled={disabled}
      onChange={(next) => {
        setSaving(next);
        void onChange(next).finally(() => {
          setSaving(null);
        });
      }}
    />
  );
}
