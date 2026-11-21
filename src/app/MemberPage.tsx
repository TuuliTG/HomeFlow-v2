import { Link, useNavigate, useParams } from 'react-router';

import { paths } from '@/app/paths';
import { LoadingMessage } from '@/components/ui/LoadingMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { MemberSettings } from '@/features/household/MemberSettings';
import { useHouseholdMembers, useOwnHousehold } from '@/features/household/useHousehold';
import { AddChildTaskLink, ChildTaskList } from '@/features/tasks/ChildTaskList';
import { useLoggedInUser } from '@/lib/auth';
import { useMessages } from '@/lib/i18n/i18n';

/**
 * An adult's page of another member of the family (`paths.member`): for a child, their tasks to set up and their
 * settings; for an adult, only whether they are a child. Reached from the family's member list.
 */
export function MemberPage() {
  const { memberId = '' } = useParams();
  const user = useLoggedInUser();
  const householdId = useOwnHousehold(user.id).data?.id ?? '';
  const members = useHouseholdMembers(householdId);
  const navigate = useNavigate();
  const { common, household, tasks } = useMessages();

  if (members.data === undefined) {
    if (!members.isError) return <LoadingMessage />;
    return (
      <p role="alert" className="text-danger-700 text-sm">
        {household.members.loadFailed}
      </p>
    );
  }
  const member = members.data.find(
    (candidate) => candidate.userId === memberId && candidate.userId !== user.id,
  );
  if (!member) return <p className="text-ink-muted text-sm">{tasks.childTasks.notFound}</p>;
  const name = member.displayName ?? common.newMember;

  return (
    <>
      <Link to={paths.household} className="text-brand-700 text-sm font-bold">
        ‹ {household.members.backToFamily}
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <PageHeader title={name} />
        {member.isChild && <AddChildTaskLink childId={memberId} name={name} />}
      </div>
      <div className="flex flex-col gap-8">
        {member.isChild && <ChildTaskList childId={memberId} />}
        <MemberSettings
          householdId={householdId}
          member={member}
          onRemoved={() => {
            void navigate(paths.household, { replace: true });
          }}
        />
      </div>
    </>
  );
}
