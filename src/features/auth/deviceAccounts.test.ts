import { describe, expect, it } from 'vitest';

import {
  type DeviceAccount,
  forgetDeviceAccount,
  keepDeviceAccount,
  readDeviceAccounts,
} from '@/features/auth/deviceAccounts';

function account(userId: string, displayName = userId): DeviceAccount {
  return {
    userId,
    displayName,
    accessToken: `access:${userId}`,
    refreshToken: `refresh:${userId}`,
  };
}

describe('device accounts', () => {
  it('lists the most recently kept account first, once', () => {
    keepDeviceAccount(account('anna'));
    keepDeviceAccount(account('ben'));
    keepDeviceAccount(account('anna', 'Anna V'));

    expect(readDeviceAccounts()).toEqual([account('anna', 'Anna V'), account('ben')]);
  });

  it('forgets an account', () => {
    keepDeviceAccount(account('anna'));
    keepDeviceAccount(account('ben'));

    forgetDeviceAccount('anna');

    expect(readDeviceAccounts()).toEqual([account('ben')]);
  });

  it.each(['not json', '{"userId":"anna"}', '[{"userId":"anna"}]'])(
    'reads nothing from damaged storage (%s)',
    (stored) => {
      localStorage.setItem('homeflow:deviceAccounts', stored);

      expect(readDeviceAccounts()).toEqual([]);
    },
  );
});
