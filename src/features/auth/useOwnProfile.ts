import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchOwnProfile, type Profile, saveOwnProfile } from '@/features/auth/api';

const profileKey = (userId: string | undefined) => ['profile', userId] as const;

export function useOwnProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileKey(userId),
    queryFn: userId ? () => fetchOwnProfile(userId) : skipToken,
  });
}

export function useSaveOwnProfile(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => saveOwnProfile(userId, displayName),
    onSuccess: (_result, displayName) => {
      queryClient.setQueryData<Profile>(profileKey(userId), { displayName });
    },
  });
}
