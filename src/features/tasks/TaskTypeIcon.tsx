import { HomeIcon, LightbulbIcon } from '@/components/ui/icons';
import type { TaskType } from '@/features/tasks/task';

const typeIconClassNames: Record<TaskType, string> = {
  physical: 'bg-brand-100 text-brand-700',
  meta: 'bg-meta-100 text-meta-700',
};

/** A tile that tells physical work from meta work at a glance; the type's tag says it in words. */
export function TaskTypeIcon({ type }: { type: TaskType }) {
  const Icon = type === 'meta' ? LightbulbIcon : HomeIcon;
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${typeIconClassNames[type]}`}
    >
      <Icon className="size-5" />
    </span>
  );
}
