export interface Household {
  id: string;
  name: string;
  inviteCode: string;
}

export interface HouseholdMember {
  userId: string;
  /** Null until the member has chosen a display name. */
  displayName: string | null;
}

/** No household has the invite code the user entered. */
export class UnknownInviteCodeError extends Error {
  constructor() {
    super('No household has this invite code');
    this.name = 'UnknownInviteCodeError';
  }
}
