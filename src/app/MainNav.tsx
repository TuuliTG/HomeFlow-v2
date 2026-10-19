import { NavLink } from 'react-router';

import { paths } from '@/app/paths';
import { ChartIcon, CheckListIcon, NewsIcon, StarIcon, UserIcon } from '@/components/ui/icons';
import { useMessages } from '@/lib/i18n/i18n';

const navItems = [
  { to: paths.me, labelKey: 'me', Icon: UserIcon },
  { to: paths.tasks, labelKey: 'tasks', Icon: CheckListIcon },
  { to: paths.news, labelKey: 'news', Icon: NewsIcon },
  { to: paths.rewards, labelKey: 'rewards', Icon: StarIcon },
  { to: paths.statistics, labelKey: 'statistics', Icon: ChartIcon },
] as const;

export function MainNav() {
  const t = useMessages();
  return (
    <nav
      aria-label={t.app.nav.label}
      className="border-line bg-surface/90 fixed inset-x-0 bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:sticky md:top-0 md:h-dvh md:w-56 md:border-t-0 md:border-r md:pt-6"
    >
      <ul className="flex justify-around md:flex-col md:gap-1 md:px-3">
        {navItems.map(({ to, labelKey, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end
              className={({ isActive }) =>
                [
                  'flex flex-col items-center gap-1 px-1 py-2 text-xs md:flex-row md:gap-3 md:rounded-xl md:px-3 md:text-sm',
                  isActive
                    ? 'text-brand-900 md:bg-brand-100 font-bold'
                    : 'text-ink-muted hover:text-ink font-semibold',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {/* On phones the active tab's icon sits in a pill; on wider screens the whole row is highlighted. */}
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full md:h-auto md:w-auto ${isActive ? 'bg-brand-100 md:bg-transparent' : ''}`}
                  >
                    <Icon className="size-6" />
                  </span>
                  {t.app.nav[labelKey]}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
