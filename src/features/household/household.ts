export interface Household {
  id: string;
  name: string;
  /** For adults to share; null for a child (`household_invite_code()`). */
  inviteCode: string | null;
}

export interface HouseholdMember {
  userId: string;
  /** Null until the member has chosen a display name. */
  displayName: string | null;
  /** Children see only tasks for children; an adult in the household decides who is one. */
  isChild: boolean;
  /** A child an adult added without email, who signs in with one-time codes the adults make. */
  signsInWithCode: boolean;
  /** Adults always; a child only when an adult lets them. */
  canAddTasks: boolean;
}

/** A one-time code a child signs in with on their own device (ADR 0003). */
export interface SignInCode {
  code: string;
  /** ISO timestamp; the code works once, until then. */
  expiresAt: string;
}

/** No household has the invite code the user entered. */
export class UnknownInviteCodeError extends Error {
  constructor() {
    super('No household has this invite code');
    this.name = 'UnknownInviteCodeError';
  }
}
