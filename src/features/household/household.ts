export interface Household {
  id: string;
  name: string;
  inviteCode: string;
}

export interface HouseholdMember {
  userId: string;
  /** Null until the member has chosen a display name. */
  displayName: string | null;
  /** Children see only tasks for children; an adult in the household decides who is one. */
  isChild: boolean;
}

/** No household has the invite code the user entered. */
export class UnknownInviteCodeError extends Error {
  constructor() {
    super('No household has this invite code');
    this.name = 'UnknownInviteCodeError';
  }
}
