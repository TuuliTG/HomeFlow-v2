import { z } from 'zod';

/**
 * Front-end-only stand-in for authentication: the "logged-in" user is just a
 * name kept in this browser's localStorage. Replace with Supabase Auth.
 */
const STORAGE_KEY = 'homeflow.mockUser';

const mockUserSchema = z.object({ name: z.string().trim().min(1) });

export type MockUser = z.infer<typeof mockUserSchema>;

export function loadMockUser(): MockUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return null;
    const parsed = mockUserSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveMockUser(user: MockUser | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (e.g. private mode); the session then lasts until reload.
  }
}
