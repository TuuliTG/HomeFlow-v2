import { useState } from 'react';

import { DEFAULT_POINTS, MAX_POINTS, NO_POINTS } from '@/features/tasks/task';

/** Family members may share a device, so each one's choice is kept apart. */
const storageKey = (userId: string) => `homeflow:default-points:${userId}`;

function isPoints(value: number): boolean {
  return Number.isInteger(value) && value >= NO_POINTS && value <= MAX_POINTS;
}

/** The points the user's new tasks start with, as chosen in the settings on this device. */
function storedDefaultPoints(userId: string): number {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(storageKey(userId));
  } catch {
    // Storage can be unavailable (e.g. private browsing); the app's default applies.
  }
  const points = stored === null ? Number.NaN : Number(stored);
  return isPoints(points) ? points : DEFAULT_POINTS;
}

function storeDefaultPoints(userId: string, points: number) {
  try {
    localStorage.setItem(storageKey(userId), String(points));
  } catch {
    // Nothing to do: the choice still holds until the app is reloaded.
  }
}

/** The user's default points for new tasks, and a way to change them (remembered on this device). */
export function useDefaultPoints(userId: string): [number, (points: number) => void] {
  const [points, setPoints] = useState(() => storedDefaultPoints(userId));
  function change(next: number) {
    if (!isPoints(next)) return;
    setPoints(next);
    storeDefaultPoints(userId, next);
  }
  return [points, change];
}
