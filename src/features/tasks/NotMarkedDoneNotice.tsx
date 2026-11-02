import { useLocation } from 'react-router';

import { isNotMarkedDoneState } from '@/features/tasks/notMarkedDone';
import { useMessages } from '@/lib/i18n/i18n';

/** After a task added as already done couldn't be marked done (`notMarkedDoneState`), asks to do it here. */
export function NotMarkedDoneNotice() {
  const t = useMessages().taskForm.create;
  if (!isNotMarkedDoneState(useLocation().state)) return null;
  return (
    <p role="status" className="bg-notice-50 text-notice-900 mb-4 rounded-xl p-3 text-sm">
      {t.notMarkedDone}
    </p>
  );
}
