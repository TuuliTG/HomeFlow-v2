import { fileURLToPath, URL } from 'node:url';

import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// Set in Vercel together with SENTRY_ORG and SENTRY_PROJECT (ADR 0002): the build then uploads source maps to Sentry,
// so reported errors point at our code, and deletes them so they aren't published.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default defineConfig({
  build: { sourcemap: uploadSourceMaps ? 'hidden' : false },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Our own service worker (src/sw.ts) so it can show push notifications (ADR 0005).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // The service worker reports nothing to Sentry, so its source map would only be published.
      // Fonts are precached along with the app, so it keeps its look offline.
      injectManifest: { sourcemap: false, globPatterns: ['**/*.{js,css,html,woff2}'] },
      // UpdateBanner registers the worker and asks before a new version takes over.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'HomeFlow',
        short_name: 'HomeFlow',
        description: 'Share household tasks fairly — and make meta work visible.',
        theme_color: '#312e81',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    uploadSourceMaps &&
      sentryVitePlugin({
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        telemetry: false,
      }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'supabase/functions/**/*.ts'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/sw.ts',
        'supabase/functions/**/index.ts',
        'supabase/functions/_shared/deno/**',
        'src/**/*.d.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
