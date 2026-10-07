import { z } from 'zod';

export const emailSchema = z.email();

/** Supabase email codes are 6 digits by default and can be configured up to 10. */
export const loginCodeSchema = z.string().regex(/^\d{6,10}$/);

/** Matches the `profiles.display_name` check constraint in the database. */
export const DISPLAY_NAME_MAX_LENGTH = 50;
export const displayNameSchema = z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH);
