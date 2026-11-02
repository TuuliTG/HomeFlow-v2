import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchPreferences, savePreference } from '@/features/notifications/api';
import type { NotificationKind } from '@/features/notifications/preferences';
import { useLoggedInUser } from '@/lib/auth';

const preferencesKey = (userId: string) => ['notification-preferences', userId] as const;

/**
 * Which kinds of notification the user gets on all their devices, and turning one on or off. A
 * change settles once the saved choices have loaded again; a failure shows as `failed`.
 */
export function useNotificationPreferences() {
  const user = useLoggedInUser();
  const queryClient = useQueryClient();
  const key = preferencesKey(user.id);

  const preferences = useQuery({ queryKey: key, queryFn: fetchPreferences });
  const save = useMutation({
    mutationFn: ({ kind, wanted }: { kind: NotificationKind; wanted: boolean }) =>
      savePreference(user.id, kind, wanted),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    preferences: preferences.data,
    setPreference: (kind: NotificationKind, wanted: boolean) =>
      save.mutateAsync({ kind, wanted }).catch(() => undefined),
    isSaving: save.isPending,
    failed: save.isError || preferences.isError,
  };
}
