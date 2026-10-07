import { Outlet } from 'react-router';

import { MainNav } from '@/app/MainNav';
import { AccountStatus } from '@/features/auth/AccountStatus';
import { HouseholdLink } from '@/features/household/HouseholdLink';

/**
 * Mobile-first layout: content plus a bottom tab bar on phones,
 * a side rail on wider screens.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh md:flex">
      <MainNav />
      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-28 md:pb-10">
        <div className="mb-4 flex items-center justify-end gap-3">
          <HouseholdLink />
          <AccountStatus />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
