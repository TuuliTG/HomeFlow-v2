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
    mutationFn: joinHousehold,
    // Stay pending until the joined household is loaded, so the next screen can show it.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: householdKey(userId) }),
  });
}
