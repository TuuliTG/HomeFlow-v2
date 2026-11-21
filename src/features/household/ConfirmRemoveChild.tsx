import { useMessages } from '@/lib/i18n/i18n';

interface ConfirmRemoveChildProps {
  name: string;
  isSaving: boolean;
  onRemove: () => void;
  onKeep: () => void;
}

/** Removing a child asks first, since their points and history can't come back. */
export function ConfirmRemoveChild({ name, isSaving, onRemove, onKeep }: ConfirmRemoveChildProps) {
  const { common, household } = useMessages();
  const t = household.members;
  return (
    <div className="bg-danger-50 flex w-full flex-col gap-3 rounded-xl p-3">
      <p className="text-danger-900 text-sm">{t.confirmRemove(name)}</p>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={isSaving}
          onClick={onRemove}
          className="bg-danger-700 hover:bg-danger-900 rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {t.yesRemove}
        </button>
        <button
          type="button"
          onClick={onKeep}
          className="text-ink hover:bg-page rounded-xl px-4 py-2 text-sm font-semibold"
        >
          {common.keepIt}
        </button>
      </div>
    </div>
  );
}
