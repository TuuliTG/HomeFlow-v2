import { paths } from '@/app/paths';
import { CancelLink } from '@/components/ui/CancelLink';
import { NEW_TASK_DEFAULTS, type NewTask } from '@/features/tasks/task';

interface TaskFormButtonsProps {
  submitLabel: string;
  disabled: boolean;
  /** The task being edited, whose list Cancel goes to when the form was opened directly. */
  initial: NewTask | undefined;
}

/** Saves the task, or goes back without saving. */
export function TaskFormButtons({ submitLabel, disabled, initial }: TaskFormButtonsProps) {
  return (
    <div className="flex gap-3">
      <button
        type="submit"
        disabled={disabled}
        className="bg-brand-700 hover:bg-brand-900 flex-1 rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-60"
      >
        {submitLabel}
      </button>
      <CancelLink fallback={paths.taskList(initial ?? NEW_TASK_DEFAULTS)} />
    </div>
  );
}
