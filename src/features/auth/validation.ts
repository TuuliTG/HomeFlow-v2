import { z } from 'zod';

export const emailSchema = z.email();

/** Keep in sync with Supabase Auth's minimum password length (`supabase/config.toml` and the dashboard). */
export const PASSWORD_MIN_LENGTH = 8;
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH);

/** Matches the `profiles.display_name` check constraint in the database. */
export const DISPLAY_NAME_MAX_LENGTH = 50;
export const displayNameSchema = z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH);
