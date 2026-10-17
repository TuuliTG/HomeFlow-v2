import { NavLink } from 'react-router';

import { paths } from '@/app/paths';
import { GearIcon } from '@/components/ui/icons';
import { useMessages } from '@/lib/i18n/i18n';

/** The gear at the top of the app that opens the settings. */
export function SettingsLink() {
  const t = useMessages().app.settings;
  return (
    <NavLink
      to={paths.settings}
      aria-label={t.title}
      title={t.title}
      className={({ isActive }) =>
        [
          'shrink-0 rounded-lg p-1.5 hover:bg-slate-100',
          isActive ? 'text-brand-900 bg-brand-50' : 'text-slate-600',
        ].join(' ')
      }
    >
      <GearIcon className="size-6" />
    </NavLink>
  );
}
