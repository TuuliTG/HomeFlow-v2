import { describe, expect, it } from 'vitest';

import { loadMockUser, saveMockUser } from '@/features/auth/mockSession';

describe('mockSession', () => {
  it('round-trips the logged-in user', () => {
    saveMockUser({ name: 'Anna' });
    expect(loadMockUser()).toEqual({ name: 'Anna' });

    saveMockUser(null);
    expect(loadMockUser()).toBeNull();
  });

  it('ignores stored data that is not a valid user', () => {
    localStorage.setItem('homeflow.mockUser', '{"name":42}');
    expect(loadMockUser()).toBeNull();

    localStorage.setItem('homeflow.mockUser', 'not json');
    expect(loadMockUser()).toBeNull();
  });
});
