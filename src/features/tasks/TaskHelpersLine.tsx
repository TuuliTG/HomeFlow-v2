import type { TaskHelper } from '@/features/tasks/task';
import { useMessages } from '@/lib/i18n/i18n';

/** "Helped by Ben (2 points)" under a done task; nothing when nobody helped. */
export function TaskHelpersLine({ helpers }: { helpers: TaskHelper[] }) {
  const { common } = useMessages();
  if (helpers.length === 0) return null;
  return (
    <span className="text-slate-500">
      {common.helpedBy(
        helpers.map((helper) => common.share(helper.name ?? common.someone, helper.points)),
      )}
    </span>
  );
}
