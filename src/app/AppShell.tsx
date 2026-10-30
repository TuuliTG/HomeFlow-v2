import { Outlet } from 'react-router';

import { InstallHint } from '@/app/InstallHint';
import { MainNav } from '@/app/MainNav';
import { SettingsLink } from '@/app/SettingsLink';
import { AccountStatus } from '@/features/auth/AccountStatus';
import { HouseholdLink } from '@/features/household/HouseholdLink';
import { TaskActivityToast } from '@/features/tasks/TaskActivityToast';
import { TaskCelebration } from '@/features/tasks/TaskCelebration';
import { WhoHelpedPrompt } from '@/features/tasks/WhoHelpedPrompt';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * Mobile-first layout: content plus a bottom tab bar on phones,
 * a side rail on wider screens. Toasts stack above the tab bar; a done task's celebration plays on top.
 * On phones the shell fills the screen and only the content scrolls, never the page: iOS can leave a scrolled
 * page's fixed elements floating mid-screen (after the keyboard closes), so the tab bar is laid out, not fixed.
 */
export function AppShell() {
  const t = useMessages().app;
  return (
    <div className="flex h-dvh flex-col md:h-auto md:min-h-dvh md:flex-row">
      <MainNav />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:overflow-visible">
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          <div className="mb-4 flex items-center justify-end gap-3">
            <HouseholdLink />
            <AccountStatus />
            <SettingsLink />
          </div>
          <InstallHint />
          <Outlet />
        </main>
      </div>
      <section
        aria-label={t.toasts}
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        <WhoHelpedPrompt />
        <TaskActivityToast />
      </section>
      <TaskCelebration />
    </div>
  );
}
