import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createHousehold,
  fetchHouseholdMembers,
  fetchOwnHousehold,
  joinHousehold,
} from '@/features/household/api';

const householdKey = (userId: string | undefined) => ['household', userId] as const;

/** The user's household: `null` when they haven't created or joined one. */
export function useOwnHousehold(userId: string | undefined) {
  return useQuery({
    queryKey: householdKey(userId),
    queryFn: userId ? fetchOwnHousehold : skipToken,
  });
}

export function useHouseholdMembers(householdId: string) {
  return useQuery({
    queryKey: ['household-members', householdId],
    queryFn: () => fetchHouseholdMembers(householdId),
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
