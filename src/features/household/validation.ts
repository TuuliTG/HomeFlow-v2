import { z } from 'zod';

/** Matches the `households.name` check constraint in the database. */
export const HOUSEHOLD_NAME_MAX_LENGTH = 50;
export const householdNameSchema = z.string().trim().min(1).max(HOUSEHOLD_NAME_MAX_LENGTH);

/**
 * Invite codes are 8 characters without look-alikes (no 0/O, 1/I). People may type them in lower
 * case or with the spaces and dashes they used to read them out, so those are tolerated.
 */
export const inviteCodeSchema = z
  .string()
  .transform((code) => code.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/));
