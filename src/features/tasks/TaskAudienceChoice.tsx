import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { useMessages } from '@/lib/i18n/i18n';

const audiences = ['adults', 'children'] as const;

interface TaskAudienceChoiceProps {
  forChildren: boolean;
  onChange: (forChildren: boolean) => void;
}

/**
 * Whether an adult's task is for the adults or for the children, chosen first as the rest of the form
 * changes to suit (ADR 0004). Only children do tasks for children.
 */
export function TaskAudienceChoice({ forChildren, onChange }: TaskAudienceChoiceProps) {
  const t = useMessages().taskForm;
  return (
    <SegmentedChoice
      legend={t.whoFor}
      showLegend
      options={audiences}
      labels={t.audiences}
      value={forChildren ? 'children' : 'adults'}
      onChange={(audience) => {
        onChange(audience === 'children');
      }}
    />
  );
}
