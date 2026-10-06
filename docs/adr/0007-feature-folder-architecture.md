# 0007. Feature-folder architecture

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

Code should be easy to navigate for agents and humans and keep features decoupled.

## Decision

`src/app` (shell, routing, providers), `src/features/<feature>/` (components, hooks, `api.ts`, tests side by side), `src/components/ui` (shared presentational components), `src/lib` (infrastructure). Features may import from `components`/`lib` but not from other features' internals. Path alias `@/` maps to `src/`.

## Consequences

- Changes stay local to a feature; dead code is easy to spot.
- Shared code must be promoted deliberately to `components/ui` or `lib`.

## Alternatives considered

- Layer folders (`components/`, `hooks/`, `services/`) — scatters a feature across the tree.
