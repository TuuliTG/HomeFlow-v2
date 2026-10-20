import { HomeIcon, LightbulbIcon } from '@/components/ui/icons';
import type { TaskIconName, TaskType } from '@/features/tasks/task';
import { TaskIcon } from '@/features/tasks/TaskIcon';

const typeIconClassNames: Record<TaskType, string> = {
  physical: 'bg-brand-100 text-brand-700',
  meta: 'bg-meta-100 text-meta-700',
};

const sizeClassNames = {
  md: { tile: 'size-10 rounded-xl', icon: 'size-5', emoji: 'text-xl' },
  lg: { tile: 'size-16 rounded-2xl', icon: 'size-9', emoji: 'text-4xl' },
} as const;

interface TaskTypeIconProps {
  type: TaskType;
  /** The task's own icon, shown instead of its type's. */
  icon?: TaskIconName | null;
  size?: keyof typeof sizeClassNames;
}

/**
 * A tile in the colours of the task's type, telling physical work from meta work at a glance, with the
 * task's icon if it has one. Decorative: the type's tag says it in words.
 */
export function TaskTypeIcon({ type, icon = null, size = 'md' }: TaskTypeIconProps) {
  const TypeIcon = type === 'meta' ? LightbulbIcon : HomeIcon;
  const classNames = sizeClassNames[size];
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${classNames.tile} ${typeIconClassNames[type]}`}
    >
      {icon ? (
        <TaskIcon name={icon} className={classNames.emoji} />
      ) : (
        <TypeIcon className={classNames.icon} />
      )}
    </span>
  );
}
