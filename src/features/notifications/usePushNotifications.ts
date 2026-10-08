import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { deleteSubscription, saveSubscription } from '@/features/notifications/api';
import {
  getDeviceSubscription,
  permission,
  pushSupport,
  subscribeDevice,
  unsubscribeDevice,
} from '@/features/notifications/browserPush';
import { readVapidPublicKey } from '@/lib/env';

export type NotificationStatus =
  'not-set-up' | 'unsupported' | 'needs-home-screen' | 'checking' | 'blocked' | 'off' | 'on';

const deviceKey = ['push-subscription'] as const;

/** Turns this device's push notifications off and forgets it; used on log-out. Never throws. */
export async function turnOffNotificationsOnThisDevice(): Promise<void> {
  try {
    if (pushSupport() !== 'supported') return;
    const endpoint = await unsubscribeDevice();
    if (endpoint) await deleteSubscription(endpoint);
  } catch {
    // Logging out must not fail because of notifications; the endpoint is gone from the browser anyway.
  }
}

/** Whether this device gets push notifications, and turning them on (from a tap) or off. */
export function usePushNotifications() {
  const queryClient = useQueryClient();
  const vapidPublicKey = readVapidPublicKey(import.meta.env);
  const support = pushSupport();
  const [declined, setDeclined] = useState(false);

  const device = useQuery({
    queryKey: deviceKey,
    queryFn: async () => (await getDeviceSubscription()) !== null,
    enabled: vapidPublicKey !== null && support === 'supported',
  });

  const turnOn = useMutation({
    mutationFn: async () => {
      if (!vapidPublicKey) throw new Error('Push notifications are not set up');
      const subscription = await subscribeDevice(vapidPublicKey);
      if (!subscription) return false;
      await saveSubscription(subscription);
      return true;
    },
    onSuccess: (isOn) => {
      setDeclined(!isOn);
      queryClient.setQueryData(deviceKey, isOn);
    },
  });

  const turnOff = useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeDevice();
      if (endpoint) await deleteSubscription(endpoint);
    },
    onSuccess: () => {
      queryClient.setQueryData(deviceKey, false);
    },
  });

  function status(): NotificationStatus {
    if (!vapidPublicKey) return 'not-set-up';
    if (support !== 'supported') return support;
    if (device.data) return 'on';
    if (declined || permission() === 'denied') return 'blocked';
    return device.isPending ? 'checking' : 'off';
  }

  return {
    status: status(),
    turnOn: () => {
      turnOn.mutate();
    },
    turnOff: () => {
      turnOff.mutate();
    },
    isChanging: turnOn.isPending || turnOff.isPending,
    failed: turnOn.isError || turnOff.isError,
  };
}
