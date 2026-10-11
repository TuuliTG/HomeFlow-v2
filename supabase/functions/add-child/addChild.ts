/**
 * What the add-child Edge Function does (ADR 0003), without Deno or Supabase, so it can be unit-tested
 * with Vitest. index.ts supplies the real dependencies.
 */
import { failure, type JsonAnswer, stringField } from '../_shared/http.ts';

/** Like `profiles.display_name`. */
const NAME_MAX_LENGTH = 50;

/** A one-time code for the child to sign in with (`add_child()`). */
export interface SignInCode {
  code: string;
  /** ISO timestamp. */
  expiresAt: string;
}

/** `add_child()` refused: the user isn't an adult in a household. */
export class NotAnAdultError extends Error {
  constructor() {
    super('Only an adult in a household can add a child');
    this.name = 'NotAnAdultError';
  }
}

export interface AddChildDependencies {
  /** The user the access token belongs to, or null for a missing or invalid one. */
  userIdFromToken: (token: string) => Promise<string | null>;
  /** Whether the user is an adult in a household, checked before a login is made for nothing. */
  isAdult: (userId: string) => Promise<boolean>;
  /** Creates a login for the child, with an address that receives no mail; resolves to its user id. */
  createChildLogin: () => Promise<string>;
  deleteLogin: (userId: string) => Promise<void>;
  /** `add_child()`: rejects with `NotAnAdultError` when the adult isn't one. */
  addChild: (adultId: string, childId: string, displayName: string) => Promise<SignInCode>;
}

function bearerToken(authorization: string | null): string | null {
  const match = /^Bearer (.+)$/.exec(authorization ?? '');
  return match?.[1] ?? null;
}

/**
 * Adds a child with this name to the logged-in adult's household and answers with their first sign-in
 * code. A login made for a child who then can't be added is removed again.
 */
export async function addChild(
  authorization: string | null,
  body: unknown,
  deps: AddChildDependencies,
): Promise<JsonAnswer> {
  const token = bearerToken(authorization);
  const adultId = token === null ? null : await deps.userIdFromToken(token);
  if (adultId === null) return failure(401, 'not_logged_in');
  const displayName = stringField(body, 'displayName')?.trim() ?? '';
  if (displayName.length < 1 || displayName.length > NAME_MAX_LENGTH) {
    return failure(400, 'invalid_name');
  }

  if (!(await deps.isAdult(adultId))) return failure(403, 'not_an_adult');

  const childId = await deps.createChildLogin();
  try {
    return { status: 200, body: await deps.addChild(adultId, childId, displayName) };
  } catch (error) {
    // Failing to clean up mustn't hide why adding failed; the stray login can't sign in anyway.
    await deps.deleteLogin(childId).catch((deleteError: unknown) => {
      console.error('add-child: could not remove the unused login', childId, deleteError);
    });
    // add_child() checks again, in case the user was made a child meanwhile.
    if (error instanceof NotAnAdultError) return failure(403, 'not_an_adult');
    throw error;
  }
}
