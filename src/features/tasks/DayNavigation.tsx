import type { ScheduleView } from '@/features/tasks/schedule';
import { addDays, fromIsoDate, today } from '@/lib/dates';
import { useMessages } from '@/lib/i18n/i18n';

interface DayNavigationProps {
  view: ScheduleView;
  /** The days shown now. */
  days: string[];
  onShow: (day: string) => void;
}

const buttonClassName =
  'flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100';

/** Which day or week the timetable shows, with buttons to go back, forward, or to today. */
export function DayNavigation({ view, days, onShow }: DayNavigationProps) {
  const t = useMessages();
  const first = days[0] ?? today();
  const last = days.at(-1) ?? first;
  const step = view === 'day' ? 1 : 7;
  const label =
    view === 'day'
      ? t.common.shortDate(fromIsoDate(first))
      : t.schedule.range(
          t.common.shortDate(fromIsoDate(first)),
          t.common.shortDate(fromIsoDate(last)),
        );
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={view === 'day' ? t.schedule.previousDay : t.schedule.previousWeek}
        onClick={() => {
          onShow(addDays(first, -step));
        }}
        className={buttonClassName}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <p aria-live="polite" className="flex-1 text-center text-sm font-semibold text-slate-900">
        {label}
      </p>
      <button
        type="button"
        onClick={() => {
          onShow(today());
        }}
        className={buttonClassName}
      >
        {t.common.today}
      </button>
      <button
        type="button"
        aria-label={view === 'day' ? t.schedule.nextDay : t.schedule.nextWeek}
        onClick={() => {
          onShow(addDays(first, step));
        }}
        className={buttonClassName}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
