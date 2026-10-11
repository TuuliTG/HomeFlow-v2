import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import {
  type Comparison,
  comparedMembers,
  comparisonOf,
  groupOf,
  hasMemberGroups,
  type MemberContribution,
  memberGroups,
  memberName,
} from '@/features/statistics/statistics';
import { useMessages } from '@/lib/i18n/i18n';

/** Who the statistics compare: a group at a tap, or members one by one; at least one stays chosen. */
export function CompareMembers({
  contributions,
  comparison,
  onChange,
  userId,
}: {
  contributions: MemberContribution[];
  comparison: Comparison;
  onChange: (comparison: Comparison) => void;
  userId: string;
}) {
  const messages = useMessages();
  const t = messages.statistics;
  const compared = comparedMembers(contributions, comparison);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-medium text-slate-700">{t.compare}</legend>
      {hasMemberGroups(contributions) && (
        <SegmentedChoice
          legend={t.compareGroup}
          options={memberGroups}
          labels={t.memberGroups}
          value={groupOf(contributions, compared)}
          onChange={onChange}
        />
      )}
      <fieldset>
        <legend className="sr-only">{t.comparedMembers}</legend>
        <div className="flex flex-wrap gap-2">
          {contributions.map((member) => {
            const checked = compared.includes(member);
            return (
              <label
                key={member.userId}
                className="has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:text-brand-900 flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 has-disabled:cursor-default"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={checked && compared.length === 1}
                  onChange={(event) => {
                    const members = contributions.filter((other) =>
                      other === member ? event.target.checked : compared.includes(other),
                    );
                    onChange(comparisonOf(contributions, members));
                  }}
                  className="accent-brand-600 size-4"
                />
                {memberName(member, userId, messages)}
              </label>
            );
          })}
        </div>
      </fieldset>
    </fieldset>
  );
}
