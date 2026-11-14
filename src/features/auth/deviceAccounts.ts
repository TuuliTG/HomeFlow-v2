import { z } from 'zod';

/** What signs an account back in, as Supabase Auth hands it out. */
export interface SessionTokens {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

/** An account that stays signed in on this device while someone else uses the app (ADR 0003). */
export interface DeviceAccount extends SessionTokens {
  displayName: string;
}

const storageKey = 'homeflow:deviceAccounts';

const accountsSchema = z.array(
  z.object({
    userId: z.string(),
    accessToken: z.string(),
    refreshToken: z.string(),
    displayName: z.string(),
  }),
);

/** The accounts waiting on this device, the most recently used first. Empty if none or unreadable. */
export function readDeviceAccounts(): DeviceAccount[] {
  try {
    const parsed = accountsSchema.safeParse(JSON.parse(localStorage.getItem(storageKey) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function writeDeviceAccounts(accounts: DeviceAccount[]): void {
  if (accounts.length === 0) localStorage.removeItem(storageKey);
  else localStorage.setItem(storageKey, JSON.stringify(accounts));
}

/**
 * Keeps `account` waiting on this device, first in the list, replacing what was kept for it before. Throws if
 * storage is unavailable, so a switch stops before it would lose the account.
 */
export function keepDeviceAccount(account: DeviceAccount): void {
  writeDeviceAccounts([
    account,
    ...readDeviceAccounts().filter(({ userId }) => userId !== account.userId),
  ]);
}

/**
 * Takes the account off the list, e.g. once it is the one in use. Never throws: unlike keeping an account,
 * failing to forget one loses nothing.
 */
export function forgetDeviceAccount(userId: string): void {
  try {
    writeDeviceAccounts(readDeviceAccounts().filter((account) => account.userId !== userId));
  } catch {
    // Storage is unavailable; the entry is dropped when it is next used or the user signs in.
  }
}
