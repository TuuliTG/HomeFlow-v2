import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkForUpdatesWhileOpen, UPDATE_CHECK_INTERVAL_MS } from '@/lib/appUpdate';

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
