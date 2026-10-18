import { describe, expect, it } from 'vitest';

import { isSkipWaitingMessage } from '@/lib/serviceWorkerMessages';

describe('isSkipWaitingMessage', () => {
  it('recognises the update banner asking the new version to take over', () => {
    expect(isSkipWaitingMessage({ type: 'SKIP_WAITING' })).toBe(true);
  });

  it.each([undefined, null, 'SKIP_WAITING', {}, { type: 'OTHER' }])('ignores %j', (data) => {
    expect(isSkipWaitingMessage(data)).toBe(false);
  });
});
