/** Why logging in or creating an account failed, in terms the login form can explain. */
export type LoginFailureReason =
  | 'wrong-credentials'
  | 'account-exists'
  | 'weak-password'
  | 'needs-email-confirmation'
  | 'too-many-attempts'
  | 'other';

export class LoginError extends Error {
  readonly reason: LoginFailureReason;

  constructor(reason: LoginFailureReason, message: string) {
    super(message);
    this.name = 'LoginError';
    this.reason = reason;
  }
}
