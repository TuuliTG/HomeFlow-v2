import { Outlet } from 'react-router';

import { InstallHint } from '@/app/InstallHint';
import { MainNav } from '@/app/MainNav';
import { AccountStatus } from '@/features/auth/AccountStatus';
import { HouseholdLink } from '@/features/household/HouseholdLink';
import { TaskActivityToast } from '@/features/tasks/TaskActivityToast';

/**
 * Mobile-first layout: content plus a bottom tab bar on phones,
 * a side rail on wider screens. Toasts stack above the tab bar.
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
        <InstallHint />
        <Outlet />
      </main>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex flex-col items-center gap-2 px-4 md:bottom-6">
        <TaskActivityToast />
      </div>
    </div>
  );
}
