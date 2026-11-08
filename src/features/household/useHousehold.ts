import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createHousehold,
  fetchHouseholdMembers,
  fetchOwnHousehold,
  addChild,
  joinHousehold,
  newChildSignInCode,
  setMemberCanAddTasks,
  setMemberIsChild,
} from '@/features/household/api';
import { useAuth } from '@/lib/auth';

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
 * Marks a member as a child or an adult. Tasks a new child gives back reach the board through its live
 * updates.
 */
export function useSetMemberIsChild(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, isChild }: { memberId: string; isChild: boolean }) =>
      setMemberIsChild(memberId, isChild),
    onSettled: () => queryClient.invalidateQueries({ queryKey: membersKey(householdId) }),
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

/** Adds a child without email to the household; resolves to their first sign-in code. */
export function useAddChild(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addChild,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey(householdId) }),
  });
}

/** Makes a new sign-in code for a child who signs in with codes. */
export function useNewChildSignInCode() {
  return useMutation({ mutationFn: newChildSignInCode });
}

interface ChildOnThisDevice {
  childId: string;
  displayName: string;
  /** Signs the child in on this device when true, out of it when false. */
  onThisDevice: boolean;
}

/**
 * Signs a child who signs in with codes in on this device with a new code, e.g. a child without a device of
 * their own, or out of it again. The account in use stays; the child is then switched to from the account
 * menu (ADR 0003).
 */
export function useSetChildOnThisDevice() {
  const { keepChildOnThisDevice, signOutOnThisDevice } = useAuth();
  return useMutation({
    mutationFn: async ({ childId, displayName, onThisDevice }: ChildOnThisDevice) => {
      if (!onThisDevice) {
        await signOutOnThisDevice(childId);
        return;
      }
      const { code } = await newChildSignInCode(childId);
      await keepChildOnThisDevice(code, displayName);
    },
  });
}

/** Lets a child add tasks, or stops them. */
export function useSetMemberCanAddTasks(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, canAddTasks }: { memberId: string; canAddTasks: boolean }) =>
      setMemberCanAddTasks(memberId, canAddTasks),
    onSettled: () => queryClient.invalidateQueries({ queryKey: membersKey(householdId) }),
  });
}
