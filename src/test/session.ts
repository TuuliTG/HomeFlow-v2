import type { AuthUser } from '@/lib/auth';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';

/** Starts the next render logged in as someone who has finished onboarding (name + household). */
export function logInAsFamilyMember(
  email = 'anna@example.com',
  displayName = 'Anna',
  householdName = 'The Virtanens',
): AuthUser {
  const user = fakeAuthBackend.logInAs(email, displayName);
  fakeHouseholdBackend.addMember(user.id, householdName);
  return user;
}
