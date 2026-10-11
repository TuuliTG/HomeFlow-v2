import { describe, expect, it, vi } from 'vitest';

import { childSignIn, type ChildSignInDependencies } from './childSignIn';

function fakeDeps() {
  return {
    takeCode: vi.fn((code: string) => Promise.resolve(code === 'KX7P-29QF' ? 'ben' : null)),
    signInTokenFor: vi.fn(() => Promise.resolve('token-hash')),
  } satisfies ChildSignInDependencies;
}

describe('child sign-in', () => {
  it("answers a valid code with a token that signs in as the code's child", async () => {
    const deps = fakeDeps();

    await expect(childSignIn({ code: 'KX7P-29QF' }, deps)).resolves.toEqual({
      status: 200,
      body: { tokenHash: 'token-hash' },
    });
    expect(deps.signInTokenFor).toHaveBeenCalledWith('ben');
  });

  it('refuses an unknown, used or expired code', async () => {
    const deps = fakeDeps();

    await expect(childSignIn({ code: 'ABCD-EFGH' }, deps)).resolves.toEqual({
      status: 401,
      body: { error: 'unknown_code' },
    });
    expect(deps.signInTokenFor).not.toHaveBeenCalled();
  });

  it.each([[{ code: '' }], [{ code: 'x'.repeat(21) }], [{ code: 12345678 }], ['KX7P-29QF']])(
    'refuses a request without a code: %j',
    async (body) => {
      const deps = fakeDeps();

      await expect(childSignIn(body, deps)).resolves.toEqual({
        status: 400,
        body: { error: 'invalid_code' },
      });
      expect(deps.takeCode).not.toHaveBeenCalled();
    },
  );
});
