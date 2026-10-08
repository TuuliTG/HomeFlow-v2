import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteSubscription, saveSubscription } from '@/features/notifications/api';
import {
  getDeviceEndpoint,
  getDeviceSubscription,
  permission,
  pushSupport,
  requestPermission,
  subscribeDevice,
  unsubscribeDevice,
} from '@/features/notifications/browserPush';
import { useLoggedInUser } from '@/lib/auth';
import { readVapidPublicKey } from '@/lib/env';

export type NotificationStatus =
  'not-set-up' | 'unsupported' | 'needs-home-screen' | 'checking' | 'blocked' | 'off' | 'on';

const deviceKey = (userId: string) => ['push-subscription', userId] as const;

/** Forgets this device and unsubscribes it; used on log-out. Never throws. */
export async function turnOffNotificationsOnThisDevice(): Promise<void> {
  if (pushSupport() !== 'supported') return;
  try {
    const endpoint = await getDeviceEndpoint();
    if (endpoint) await deleteSubscription(endpoint);
  } catch {
    // Logging out must not fail because of notifications; the push service drops the row later.
  } finally {
    await unsubscribeDevice().catch(() => undefined);
  }
}

/**
 * Whether this device gets push notifications, and turning them on (from a tap) or off. Each load
 * re-saves an existing subscription, so the database matches the browser and the device belongs
 * to whoever is logged in now (ADR 0005).
 */
export function usePushNotifications() {
  const user = useLoggedInUser();
  const queryClient = useQueryClient();
  const vapidPublicKey = readVapidPublicKey(import.meta.env);
  const support = pushSupport();
  const key = deviceKey(user.id);

  const device = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!vapidPublicKey) return false;
      const subscription = await getDeviceSubscription(vapidPublicKey);
      if (subscription) await saveSubscription(subscription);
      return subscription !== null;
    },
    enabled: vapidPublicKey !== null && support === 'supported',
  });

  const turnOn = useMutation({
    // The permission prompt is already open; don't let an "offline" guess pause the rest.
    networkMode: 'always',
    mutationFn: async (asked: Promise<NotificationPermission>) => {
      if ((await asked) !== 'granted' || !vapidPublicKey) return false;
      const subscription = await subscribeDevice(vapidPublicKey);
      try {
        await saveSubscription(subscription);
      } catch (error) {
        await unsubscribeDevice();
        throw error;
      }
      return true;
    },
    onMutate: () => {
      turnOff.reset();
    },
    onSuccess: (isOn) => {
      queryClient.setQueryData(key, isOn);
    },
  });

  const turnOff = useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      const endpoint = await getDeviceEndpoint();
      if (endpoint) await deleteSubscription(endpoint);
      await unsubscribeDevice();
    },
    onMutate: () => {
      turnOn.reset();
    },
    onSuccess: () => {
      queryClient.setQueryData(key, false);
    },
  });

  function status(): NotificationStatus {
    if (!vapidPublicKey) return 'not-set-up';
    if (support !== 'supported') return support;
    if (permission() === 'denied') return 'blocked';
    if (device.data) return 'on';
    return device.isPending ? 'checking' : 'off';
  }

  return {
    status: status(),
    // Ask for permission synchronously in the tap handler; the rest can wait for the answer.
    turnOn: () => {
      turnOn.mutate(requestPermission());
    },
    turnOff: () => {
      turnOff.mutate();
    },
    isChanging: turnOn.isPending || turnOff.isPending,
    failed: turnOn.isError || turnOff.isError || device.isError,
  };
}
