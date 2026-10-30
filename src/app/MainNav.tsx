import { NavLink } from 'react-router';

import { paths } from '@/app/paths';
import { ChartIcon, CheckListIcon, NewsIcon, StarIcon, UserIcon } from '@/components/ui/icons';
import { useIsChild } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/** The tabs everyone has, children included. */
const childNavItems = [
  { to: paths.me, labelKey: 'me', Icon: UserIcon },
  { to: paths.tasks, labelKey: 'tasks', Icon: CheckListIcon },
] as const;

const adultNavItems = [
  ...childNavItems,
  { to: paths.news, labelKey: 'news', Icon: NewsIcon },
  { to: paths.rewards, labelKey: 'rewards', Icon: StarIcon },
  { to: paths.statistics, labelKey: 'statistics', Icon: ChartIcon },
] as const;

/** The tabs: a child has only Me and Shared tasks; the rest appear once the user is known to be an adult. */
export function MainNav() {
  const t = useMessages();
  const user = useLoggedInUser();
  const navItems = useIsChild(user.id) === false ? adultNavItems : childNavItems;
  return (
    <nav
      aria-label={t.app.nav.label}
      className="border-line bg-surface order-last shrink-0 border-t pb-[env(safe-area-inset-bottom)] md:sticky md:top-0 md:order-first md:h-dvh md:w-56 md:border-t-0 md:border-r md:pt-6"
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
