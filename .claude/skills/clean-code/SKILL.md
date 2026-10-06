---
name: clean-code
description: Clean code standards for HomeFlow TypeScript/React code — naming, function and component size, types, structure. Use while writing or reviewing any code.
---

# Clean code

## Naming

- Names reveal intent: `pickUpTask`, `fairnessScore`, `isOverdue`. No abbreviations or `data`/`info`/`handle2`.
- Booleans read as questions (`is`, `has`, `can`); event handlers `onX` (props) / `handleX` (implementation).
- Use domain language from `docs/product-brief.md` (task, member, points, planning task, fairness, family goal).

## Functions & components

- One responsibility each. Functions ≲ 20 lines, components ≲ 100 lines (ESLint: complexity ≤ 10, depth ≤ 3,
  params ≤ 3, files ≤ 250 lines). Extract when a part has its own name.
- Prefer pure functions for domain logic (points, fairness, bonuses) in plain `.ts` files — easy to test, no React.
- Components: presentational vs. data-connected. Data comes through hooks, not inline fetches.
- Pass objects for > 3 params. Early returns over nested ifs.
- No magic numbers/strings: named constants (`const CREATION_POINTS = 1`).

## Types

- No `any`, no non-null `!`, no `@ts-ignore`. Use `unknown` + Zod at boundaries (API, storage, URL params, env).
- Model states explicitly (discriminated unions) instead of several booleans.
- Derive types from schemas (`z.infer`) or the Supabase-generated types; don't duplicate them by hand.

## Structure

- Follow `docs/adr/0007-feature-folder-architecture.md`. Co-locate tests with code.
- DRY sensibly: extract on the third repetition, or the second if the logic is a business rule.
- Comments explain _why_, not _what_. Delete dead and commented-out code.

## React specifics

- Derive values instead of syncing state with `useEffect`. Effects only for external systems.
- Keys are stable ids, never array indexes for dynamic lists.
- Accessible markup first: semantic elements, labelled controls, visible focus, touch targets ≥ 44px.
