import { PASSWORD_MIN_LENGTH } from '@/features/auth/validation';
import type { Messages } from '@/lib/i18n/i18n';

/** Why logging in or creating an account failed, in terms the login form can explain. */
export type LoginFailureReason =
  | 'wrong-credentials'
  | 'account-exists'
  | 'weak-password'
  | 'needs-email-confirmation'
  | 'too-many-attempts'
  | 'unknown-child-code'
  | 'other';

export class LoginError extends Error {
  readonly reason: LoginFailureReason;

  constructor(reason: LoginFailureReason, message: string) {
    super(message);
    this.name = 'LoginError';
    this.reason = reason;
  }
}

/** What to tell the user when logging in failed for this reason. */
export function failureMessage(reason: LoginFailureReason, t: Messages): string {
  const message = t.auth.failures[reason];
  return typeof message === 'string' ? message : message(PASSWORD_MIN_LENGTH);
}
