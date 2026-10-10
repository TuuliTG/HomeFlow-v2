import { StarIcon } from '@/components/ui/icons';

const variantClassNames = {
  /** Boxed like an input, next to the task name field. */
  field:
    'rounded-lg border border-slate-300 bg-white hover:border-amber-500 aria-pressed:border-amber-500',
  /** Just the star, on a task in a list. */
  plain: 'rounded-full hover:bg-amber-50',
};

interface FavouriteStarButtonProps {
  /** The accessible name, e.g. "Favourite" or "Favourite: Vacuum". */
  label: string;
  isFavourite: boolean;
  disabled: boolean;
  onChange: (isFavourite: boolean) => void;
  variant: keyof typeof variantClassNames;
}

/** A star toggle that makes a task a favourite of the household, or no longer one. */
export function FavouriteStarButton({
  label,
  isFavourite,
  disabled,
  onChange,
  variant,
}: FavouriteStarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isFavourite}
      disabled={disabled}
      onClick={() => {
        onChange(!isFavourite);
      }}
      className={`flex size-11 shrink-0 items-center justify-center text-slate-500 disabled:opacity-50 aria-pressed:text-amber-600 ${variantClassNames[variant]}`}
    >
      <StarIcon className="size-6" fill={isFavourite ? 'currentColor' : 'none'} />
    </button>
  );
}
