import { Outlet } from 'react-router';

import { MainNav } from '@/app/MainNav';

/**
 * Mobile-first layout: content plus a bottom tab bar on phones,
 * a side rail on wider screens.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh md:flex">
      <MainNav />
      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-28 md:pb-10">
        <Outlet />
      </main>
    </div>
  );
}
