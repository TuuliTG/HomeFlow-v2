// @ts-check
import { readdirSync } from 'node:fs';

import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const FEATURES = readdirSync(new URL('src/features', import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

// Keep the Supabase client out of UI code — data access goes through feature api modules.
const SUPABASE_IMPORT = {
  name: '@supabase/supabase-js',
  message: 'Use getSupabaseClient() from @/lib/supabase inside a feature api module.',
};

/** @param {{ group: string[]; message: string }[]} patterns */
const restrictImports = (patterns = []) => ['error', { paths: [SUPABASE_IMPORT], patterns }];

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'coverage',
      'playwright-report',
      'test-results',
      'supabase/.temp',
      // Deno entry points and Deno-only modules (npm:/jsr: imports, Deno globals); type-checked with
      // `deno check` instead.
      'supabase/functions/**/index.ts',
      'supabase/functions/_shared/deno/**',
      'eslint.config.js',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Clean code guard rails — see .claude/skills/clean-code
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 3],
      'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['src/**/*.tsx'],
    extends: [
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.strict,
    ],
    rules: {
      // A scrolling region (role="region" with a name) must be focusable to scroll it with the keyboard,
      // as axe's scrollable-region-focusable rule requires, e.g. the timetable (ADR 0004).
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['tabpanel', 'region'] }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrictImports() },
  },
  // Features stay independent: shared code moves to components/ui or lib, and cross-feature composition lives in
  // src/app (AGENTS.md). Features are flat folders, so a relative `../` import always leaves the feature.
  ...FEATURES.map((feature) => ({
    files: [`src/features/${feature}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': restrictImports([
        {
          group: ['@/features/*', `!@/features/${feature}`, '../*'],
          message:
            'Features must not import other features; move shared code to components/ui or lib.',
        },
      ]),
    },
  })),
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports([
        {
          group: ['@/features/*', '@/app/*'],
          message: 'Shared code must not depend on features or the app shell.',
        },
      ]),
    },
  },
  {
    files: ['src/lib/supabase.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'e2e/**/*.ts'],
    rules: { 'max-lines': 'off' },
  },
  prettier,
);
