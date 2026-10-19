import { useState } from 'react';

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

/** An adult adds a child without email, who then signs in with a one-time code (ADR 0003). */
export function AddChildForm({ householdId, onAdded }: AddChildFormProps) {
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
        hint={t.hint}
      />
    </section>
  );
}
