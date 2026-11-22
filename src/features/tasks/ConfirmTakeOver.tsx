import { useMessages } from '@/lib/i18n/i18n';

interface ConfirmTakeOverProps {
  pickerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before marking done a task another member has picked up. */
export function ConfirmTakeOver({ pickerName, onConfirm, onCancel }: ConfirmTakeOverProps) {
  const t = useMessages();
  return (
    <div
      role="group"
      aria-label={t.tasks.card.confirmTakeOverLabel(pickerName)}
      className="bg-notice-50 text-notice-900 flex flex-col gap-2 rounded-xl p-3 text-sm"
    >
      <p>{t.tasks.card.confirmTakeOver(pickerName)}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="bg-surface text-ink hover:bg-page min-h-11 rounded-xl px-4 font-bold"
        >
          {t.common.cancel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="bg-brand-700 hover:bg-brand-900 min-h-11 rounded-xl px-4 font-bold text-white"
        >
          {t.tasks.card.yesIDidIt}
        </button>
      </div>
    </div>
  );
}
