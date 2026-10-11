import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createHousehold,
  fetchHouseholdMembers,
  fetchOwnHousehold,
  joinHousehold,
  setMemberIsChild,
} from '@/features/household/api';
import type { HouseholdMember } from '@/features/household/household';

const householdKey = (userId: string | undefined) => ['household', userId] as const;

/** The user's household: `null` when they haven't created or joined one. */
export function useOwnHousehold(userId: string | undefined) {
  return useQuery({
    queryKey: householdKey(userId),
    queryFn: userId ? fetchOwnHousehold : skipToken,
  });
}

const membersKey = (householdId: string) => ['household-members', householdId] as const;

export function useHouseholdMembers(householdId: string) {
  return useQuery({
    queryKey: membersKey(householdId),
    queryFn: () => fetchHouseholdMembers(householdId),
  });
}

/**
 * Marks a member as a child or an adult, showing it straight away and going back if saving fails. Tasks
 * a new child gives back reach the board through its live updates.
 */
export function useSetMemberIsChild(householdId: string) {
  const queryClient = useQueryClient();
  const queryKey = membersKey(householdId);
  return useMutation({
    mutationFn: ({ memberId, isChild }: { memberId: string; isChild: boolean }) =>
      setMemberIsChild(memberId, isChild),
    onMutate: async ({ memberId, isChild }) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<HouseholdMember[]>(queryKey, (members) =>
        members?.map((member) => (member.userId === memberId ? { ...member, isChild } : member)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export function useCreateHousehold(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createHousehold,
    onSuccess: (household) => {
      queryClient.setQueryData(householdKey(userId), household);
    },
  });
}

export function useJoinHousehold(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // Load the joined household as part of joining, so a failure shows as an error and success
    // lands on a screen that can show it.
    mutationFn: async (inviteCode: string) => {
      await joinHousehold(inviteCode);
      return fetchOwnHousehold();
    },
    onSuccess: (household) => {
      queryClient.setQueryData(householdKey(userId), household);
    },
  });
}
