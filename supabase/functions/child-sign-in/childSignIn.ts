/**
 * What the child-sign-in Edge Function does (ADR 0003), without Deno or Supabase, so it can be
 * unit-tested with Vitest. index.ts supplies the real dependencies.
 */
import { failure, type JsonAnswer, stringField } from '../_shared/http.ts';

/** Longer than any code, even typed with dashes and spaces. */
const CODE_MAX_LENGTH = 20;

export interface ChildSignInDependencies {
  /** `take_child_sign_in_code()`: uses the code up and resolves to whose it is, or null. */
  takeCode: (code: string) => Promise<string | null>;
  /** A one-time token that signs in as the child (`verifyOtp` in the app), like a magic link's. */
  signInTokenFor: (childId: string) => Promise<string>;
}

/** Turns a child's one-time code into a token the app signs in with. */
export async function childSignIn(
  body: unknown,
  deps: ChildSignInDependencies,
): Promise<JsonAnswer> {
  const code = stringField(body, 'code') ?? '';
  if (code.length === 0 || code.length > CODE_MAX_LENGTH) return failure(400, 'invalid_code');
  const childId = await deps.takeCode(code);
  if (childId === null) return failure(401, 'unknown_code');
  return { status: 200, body: { tokenHash: await deps.signInTokenFor(childId) } };
}
