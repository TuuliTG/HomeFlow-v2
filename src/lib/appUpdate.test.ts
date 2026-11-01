import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkForUpdatesWhileOpen,
  reloadIntoNewVersion,
  UPDATE_CHECK_INTERVAL_MS,
} from '@/lib/appUpdate';

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('checkForUpdatesWhileOpen', () => {
  const update = vi.fn(() => Promise.resolve());
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    update.mockClear();
    stop = checkForUpdatesWhileOpen({ update });
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('checks when the app comes back to the foreground', () => {
    setVisibility('visible');

    expect(update).toHaveBeenCalledOnce();
  });

  it('does not check when the app goes to the background', () => {
    setVisibility('hidden');

    expect(update).not.toHaveBeenCalled();
  });

  it('checks regularly while the app stays open', () => {
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS * 2);

    expect(update).toHaveBeenCalledTimes(2);
  });

  it('ignores a failed check, e.g. when offline', () => {
    update.mockRejectedValueOnce(new Error('offline'));

    expect(() => {
      setVisibility('visible');
    }).not.toThrow();
  });

  it('stops checking when told to', () => {
    stop();
    setVisibility('visible');
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);

    expect(update).not.toHaveBeenCalled();
  });
});

describe('reloadIntoNewVersion', () => {
  function setUp(waiting: ServiceWorker | null) {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    const serviceWorker = new EventTarget();
    const skipWaiting = vi.fn(() => Promise.resolve());
    reloadIntoNewVersion({ registration: { waiting }, serviceWorker, skipWaiting });
    return { reload, serviceWorker, skipWaiting };
  }

  it('lets the waiting version take over and reloads once it has', () => {
    const { reload, serviceWorker, skipWaiting } = setUp({} as ServiceWorker);

    expect(skipWaiting).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    serviceWorker.dispatchEvent(new Event('controllerchange'));

    expect(reload).toHaveBeenCalledOnce();
  });

  it('just reloads when another window already let the new version in', () => {
    const { reload, skipWaiting } = setUp(null);

    expect(reload).toHaveBeenCalledOnce();
    expect(skipWaiting).not.toHaveBeenCalled();
  });
});
