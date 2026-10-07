import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * Never a real project: e2e/fakeSupabase.ts answers every request to this URL. It shares the app's
 * origin so browsers send no CORS preflights, which WebKit and Chromium handle differently.
 */
export const FAKE_SUPABASE_URL = `http://localhost:${PORT}/fake-supabase`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 15'] } },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: FAKE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: 'e2e-anon-key' },
  },
});
