# 0006. Testing strategy

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

Agents change code frequently; automated tests are the main safety net and must run both locally, in CI and in cloud agent sessions (no Docker).

## Decision

- **Vitest + React Testing Library** for units and components, querying by role/label as a user would. Coverage threshold 80%.
- **Playwright** e2e on Pixel, iPhone and desktop viewports, including **axe** accessibility checks.
- Supabase is mocked at the feature `api` module boundary in unit tests; database/RLS tests run against local Supabase in CI when the schema exists.

## Consequences

- Fast feedback; mobile layouts are tested, not assumed.
- Mocks can drift from real DB behaviour — RLS/integration tests cover that.

## Alternatives considered

- Snapshot-heavy testing — brittle, low signal.
