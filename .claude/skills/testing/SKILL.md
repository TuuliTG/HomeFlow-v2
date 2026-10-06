---
name: testing
description: How to test HomeFlow — what to test at each layer with Vitest, React Testing Library and Playwright, and how to mock Supabase. Use when writing or changing any code or test.
---

# Testing

Every behaviour change comes with tests. Coverage threshold is 80% and must not be lowered.

## Layers

| Layer                                    | Tool                                                       | Location                   | Test                                               |
| ---------------------------------------- | ---------------------------------------------------------- | -------------------------- | -------------------------------------------------- |
| Domain logic (points, fairness, bonuses) | Vitest                                                     | `src/features/x/*.test.ts` | Pure functions, edge cases, table-driven `it.each` |
| Components & hooks                       | Vitest + RTL                                               | next to component          | What the user sees and does                        |
| Routing/shell                            | Vitest + `renderAppAt()` (`src/test/renderWithRouter.tsx`) | `src/app`                  | Navigation                                         |
| User flows, layout, a11y                 | Playwright + axe                                           | `e2e/*.spec.ts`            | Critical journeys on mobile + desktop              |
| DB policies (RLS)                        | SQL/integration in CI (local Supabase)                     | `supabase/tests`           | Members can't see other families' data             |

## Rules

- Query like a user: `getByRole`, `getByLabelText`, `getByText`. `data-testid` only as last resort.
- Interact via `userEvent.setup()`, assert visible outcomes — not internal state or implementation calls.
- Mock at the boundary: mock the feature `api.ts` module (`vi.mock('@/features/tasks/api')`), never React internals.
  Never hit a real Supabase project from unit tests.
- Wrap components using TanStack Query in a fresh `QueryClient` per test (retries off).
- One behaviour per test; descriptive names (`it('awards creation points when a task is added')`).
- No snapshot tests for components. No sleeps — use `findBy*` / Playwright auto-waiting.
- Bug fix ⇒ first a failing test that reproduces it.
- E2E: add/extend a spec when a user flow changes; keep the axe check passing.
