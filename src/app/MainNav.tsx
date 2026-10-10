import { NavLink } from 'react-router';

import { paths } from '@/app/paths';
import { ChartIcon, CheckListIcon, StarIcon, UserIcon } from '@/components/ui/icons';

const navItems = [
  { to: paths.me, label: 'Me', Icon: UserIcon },
  { to: paths.tasks, label: 'Shared tasks', Icon: CheckListIcon },
  { to: paths.rewards, label: 'Rewards', Icon: StarIcon },
  { to: paths.statistics, label: 'Statistics', Icon: ChartIcon },
] as const;

export function MainNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:sticky md:top-0 md:h-dvh md:w-56 md:border-t-0 md:border-r md:pt-6"
    >
      <ul className="flex justify-around md:flex-col md:gap-1 md:px-3">
        {navItems.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end
              className={({ isActive }) =>
                [
                  'flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium md:flex-row md:gap-3 md:rounded-lg md:text-sm',
                  isActive
                    ? 'text-brand-900 md:bg-brand-50'
                    : 'text-slate-500 hover:text-slate-800',
                ].join(' ')
              }
            >
              <Icon className="size-6" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
