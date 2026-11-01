import { type InputHTMLAttributes, type SyntheticEvent, useId, useState } from 'react';

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
}

/** A form with one text field and a submit button; the caller validates and saves the value. */
export function SingleFieldForm({
  label,
  submitLabel,
  inputProps,
  error,
  isPending,
  onSubmit,
}: SingleFieldFormProps) {
  const [value, setValue] = useState('');
  const errorId = useId();

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    onSubmit(value);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <label className="text-ink flex flex-col gap-1 text-sm font-medium">
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
        <p id={errorId} role="alert" className="text-danger-700 text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-700 hover:bg-brand-900 rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  );
}
