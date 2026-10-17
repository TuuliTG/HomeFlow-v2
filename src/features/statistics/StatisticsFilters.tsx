import { ChevronDownIcon } from '@/components/ui/icons';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { CompareMembers } from '@/features/statistics/CompareMembers';
import {
  type Comparison,
  comparedMembers,
  groupOf,
  type MemberContribution,
  memberName,
  type PointsFilter,
  pointsFilters,
} from '@/features/statistics/statistics';
import { type Messages, useMessages } from '@/lib/i18n/i18n';

interface StatisticsFiltersProps {
  contributions: MemberContribution[];
  /** Null when there is no one to choose between. */
  comparison: Comparison | null;
  onComparisonChange: (comparison: Comparison) => void;
  pointsFilter: PointsFilter;
  onPointsFilterChange: (filter: PointsFilter) => void;
  userId: string;
  /** Kept by the parent, so the panel stays open while another period loads. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ChosenFilters = Pick<
  StatisticsFiltersProps,
  'contributions' | 'comparison' | 'pointsFilter' | 'userId'
>;

/** The filters that differ from the defaults, e.g. "Adults · Physical"; empty when none do. */
function activeFilters(
  { contributions, comparison, pointsFilter, userId }: ChosenFilters,
  messages: Messages,
): string {
  const t = messages.statistics;
  const active: string[] = [];
  if (comparison !== null) {
    const compared = comparedMembers(contributions, comparison);
    const group = groupOf(contributions, compared);
    if (group !== 'everyone') {
      active.push(
        group
          ? t.memberGroups[group]
          : compared.map((member) => memberName(member, userId, messages)).join(', '),
      );
    }
  }
  if (pointsFilter !== 'all') active.push(t.pointsFilters[pointsFilter]);
  return active.join(' · ');
}

/** Who to compare and which work counts, folded away so the statistics come first; the summary names what is active. */
export function StatisticsFilters(props: StatisticsFiltersProps) {
  const {
    contributions,
    comparison,
    onComparisonChange,
    pointsFilter,
    onPointsFilterChange,
    userId,
    open,
    onOpenChange,
  } = props;
  const messages = useMessages();
  const t = messages.statistics;
  const active = activeFilters(props, messages);
  return (
    <details
      open={open}
      onToggle={(event) => {
        onOpenChange(event.currentTarget.open);
      }}
      className="group rounded-xl border border-slate-200 bg-white"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 text-sm font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
        {t.filters}
        {active && (
          <span className="bg-brand-50 text-brand-900 min-w-0 rounded-full px-3 py-0.5 text-xs font-semibold">
            {active}
          </span>
        )}
        <ChevronDownIcon className="ml-auto size-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-slate-200 p-4">
        {comparison !== null && (
          <CompareMembers
            contributions={contributions}
            comparison={comparison}
            onChange={onComparisonChange}
            userId={userId}
          />
        )}
        <SegmentedChoice
          legend={t.workType}
          showLegend
          options={pointsFilters}
          labels={t.pointsFilters}
          value={pointsFilter}
          onChange={onPointsFilterChange}
        />
      </div>
    </details>
  );
}
