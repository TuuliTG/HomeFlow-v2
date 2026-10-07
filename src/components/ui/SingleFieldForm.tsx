import {
  type InputHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
  useId,
  useState,
} from 'react';

import { inputClassName } from '@/components/ui/formStyles';

type InputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'name' | 'autoComplete' | 'autoCapitalize' | 'maxLength' | 'placeholder'
>;

interface SingleFieldFormProps {
  label: string;
  submitLabel: string;
  inputProps: InputProps;
  /** Shown under the field, e.g. the validation or save error. */
  error: string | null;
  isPending: boolean;
  onSubmit: (value: string) => void;
  hint?: ReactNode;
}

/** A form with one text field and a submit button; the caller validates and saves the value. */
export function SingleFieldForm({
  label,
  submitLabel,
  inputProps,
  error,
  isPending,
  onSubmit,
  hint,
}: SingleFieldFormProps) {
  const [value, setValue] = useState('');
  const errorId = useId();

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    onSubmit(value);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        {label}
        <input
          type="text"
          {...inputProps}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={inputClassName}
        />
      </label>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-600 hover:bg-brand-900 rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {submitLabel}
      </button>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </form>
  );
}
