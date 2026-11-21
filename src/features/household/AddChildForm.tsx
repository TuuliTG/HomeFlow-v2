import { useState } from 'react';

import { PlusIcon } from '@/components/ui/icons';
import { SingleFieldForm } from '@/components/ui/SingleFieldForm';
import type { SignInCode } from '@/features/household/household';
import { useAddChild } from '@/features/household/useHousehold';
import { CHILD_NAME_MAX_LENGTH, childNameSchema } from '@/features/household/validation';
import { useMessages } from '@/lib/i18n/i18n';

interface AddChildFormProps {
  householdId: string;
  /** Called with the new child's name and the code they sign in with. */
  onAdded: (childName: string, signInCode: SignInCode) => void;
}

/**
 * An adult adds a child without email, who then signs in with a one-time code (ADR 0003). An occasional task, so
 * it waits behind one quiet row until opened.
 */
export function AddChildForm({ householdId, onAdded }: AddChildFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addChild = useAddChild(householdId);
  const t = useMessages().household.addChild;

  function handleSubmit(name: string) {
    const parsed = childNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(t.nameRequired);
      return;
    }
    setError(null);
    addChild.mutate(parsed.data, {
      onSuccess: (signInCode) => {
        onAdded(parsed.data, signInCode);
      },
      onError: () => {
        setError(t.failed);
      },
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
        }}
        className="bg-surface shadow-card text-brand-700 hover:bg-brand-50 flex min-h-14 items-center gap-2 rounded-2xl px-4 text-left font-semibold"
      >
        <PlusIcon className="size-5 shrink-0" strokeWidth={2.4} />
        {t.heading}
      </button>
    );
  }
  return (
    <section aria-labelledby="add-child" className="flex flex-col gap-3">
      <h2 id="add-child" className="text-ink font-semibold">
        {t.heading}
      </h2>
      <SingleFieldForm
        label={t.label}
        submitLabel={t.submit}
        inputProps={{ name: 'child-name', autoComplete: 'off', maxLength: CHILD_NAME_MAX_LENGTH }}
        error={error}
        isPending={addChild.isPending}
        onSubmit={handleSubmit}
      />
    </section>
  );
}
