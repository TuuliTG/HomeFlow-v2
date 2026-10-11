import { describe, expect, it, vi } from 'vitest';

import { addChild, type AddChildDependencies, NotAnAdultError } from './addChild';

const code = { code: 'KX7P29QF', expiresAt: '2026-10-11T12:15:00Z' };

function fakeDeps(overrides: Partial<AddChildDependencies> = {}) {
  return {
    userIdFromToken: vi.fn((token: string) =>
      Promise.resolve(token === 'anna-token' ? 'anna' : null),
    ),
    createChildLogin: vi.fn(() => Promise.resolve('ben')),
    deleteLogin: vi.fn(() => Promise.resolve()),
    addChild: vi.fn(() => Promise.resolve(code)),
    ...overrides,
  } satisfies AddChildDependencies;
}

describe('add child', () => {
  it("adds a child to the adult's household and answers with their sign-in code", async () => {
    const deps = fakeDeps();

    await expect(addChild('Bearer anna-token', { displayName: ' Ben ' }, deps)).resolves.toEqual({
      status: 200,
      body: code,
    });
    expect(deps.addChild).toHaveBeenCalledWith('anna', 'ben', 'Ben');
    expect(deps.deleteLogin).not.toHaveBeenCalled();
  });

  it.each([
    ['no token', null],
    ['an unknown token', 'Bearer someone-else'],
    ['another kind of authorization', 'Basic anna-token'],
  ])('refuses %s', async (_case, authorization) => {
    const deps = fakeDeps();

    await expect(addChild(authorization, { displayName: 'Ben' }, deps)).resolves.toEqual({
      status: 401,
      body: { error: 'not_logged_in' },
    });
    expect(deps.createChildLogin).not.toHaveBeenCalled();
  });

  it.each([[{ displayName: '  ' }], [{ displayName: 'x'.repeat(51) }], [{}], [null]])(
    'refuses a missing or too long name: %j',
    async (body) => {
      const deps = fakeDeps();

      await expect(addChild('Bearer anna-token', body, deps)).resolves.toEqual({
        status: 400,
        body: { error: 'invalid_name' },
      });
      expect(deps.createChildLogin).not.toHaveBeenCalled();
    },
  );

  it('removes the login again when the user is not an adult', async () => {
    const deps = fakeDeps({ addChild: () => Promise.reject(new NotAnAdultError()) });

    await expect(addChild('Bearer anna-token', { displayName: 'Ben' }, deps)).resolves.toEqual({
      status: 403,
      body: { error: 'not_an_adult' },
    });
    expect(deps.deleteLogin).toHaveBeenCalledWith('ben');
  });

  it('removes the login again and fails when adding goes wrong', async () => {
    const failure = new Error('Database down');
    const deps = fakeDeps({ addChild: () => Promise.reject(failure) });

    await expect(addChild('Bearer anna-token', { displayName: 'Ben' }, deps)).rejects.toBe(failure);
    expect(deps.deleteLogin).toHaveBeenCalledWith('ben');
  });
});
