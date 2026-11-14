import {
  childSessionFromCode,
  currentSessionTokens,
  endKeptSession,
  fetchOwnProfile,
  signInWithTokens,
} from '@/features/auth/api';
import {
  forgetDeviceAccount,
  keepDeviceAccount,
  readDeviceAccounts,
  type SessionTokens,
} from '@/features/auth/deviceAccounts';
import { AccountSignedOutError } from '@/lib/auth';

// Several members can stay signed in on one device, e.g. a parent and a child without a device of their own
// (ADR 0003). Each keeps their own Supabase session, so RLS sees whoever uses the app; the others wait in
// `deviceAccounts` until someone switches back to them.

/** Keeps the account in use waiting on this device, so it can be switched back to without logging in. */
async function keepCurrentAccount(): Promise<SessionTokens | null> {
  const signedIn = await currentSessionTokens();
  if (!signedIn) return null;
  const profile = await fetchOwnProfile(signedIn.userId);
  // Read the tokens again right before switching: they may have been refreshed while the profile loaded.
  const current = await currentSessionTokens();
  if (!current) return null;
  keepDeviceAccount({ ...current, displayName: profile?.displayName ?? '' });
  return current;
}

/** Stays with the account that was in use, after switching away from it failed. */
async function stayWith(current: SessionTokens | null): Promise<void> {
  if (!current) return;
  // Switching rarely drops the current session; make sure it is in use. If that fails too, keep it on the
  // list so the login page offers to continue as it.
  const restored = await signInWithTokens(current).catch(() => false);
  if (restored) forgetDeviceAccount(current.userId);
}

/**
 * Continues as `userId`, an account waiting on this device, keeping the current one waiting in its place.
 * If its session has ended (e.g. it logged out elsewhere) it is forgotten, and the current account stays.
 */
export async function switchToDeviceAccount(userId: string): Promise<void> {
  const target = readDeviceAccounts().find((account) => account.userId === userId);
  if (!target) throw new AccountSignedOutError();
  const current = await keepCurrentAccount();
  let signedIn: boolean;
  try {
    signedIn = await signInWithTokens(target);
  } catch (error) {
    await stayWith(current);
    throw error;
  }
  if (!signedIn) {
    await stayWith(current);
    forgetDeviceAccount(userId);
    throw new AccountSignedOutError();
  }
  forgetDeviceAccount(userId);
}

/**
 * Signs a child in with a sign-in code on this device, where they wait to be switched to; the account in use
 * stays.
 */
export async function keepChildOnThisDevice(code: string, displayName: string): Promise<void> {
  const child = await childSessionFromCode(code);
  keepDeviceAccount({ ...child, displayName });
}

/**
 * Signs an account waiting on this device out of it: its session ends, then the device forgets it. If ending
 * the session fails (e.g. offline), it stays signed in here to try again.
 */
export async function signOutOnThisDevice(userId: string): Promise<void> {
  const kept = readDeviceAccounts().find((account) => account.userId === userId);
  if (!kept) return;
  await endKeptSession(kept);
  forgetDeviceAccount(userId);
}
