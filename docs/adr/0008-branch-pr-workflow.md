# 0008. Branch → PR → main workflow

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

Changes come from local and cloud agent sessions (including from a phone). `main` must always be deployable.

## Decision

All work happens on short-lived branches (`feat/`, `fix/`, `chore/`, `docs/`, `refactor/`) with Conventional Commit messages, merged to `main` via PR only after CI passes. Agents run `npm run verify` and the housekeeping checklist before opening a PR. A Claude Code hook blocks commits/pushes to `main`.

## Consequences

- `main` stays green and production stays stable.
- Slight overhead for tiny changes — accepted.

## Alternatives considered

- Trunk-based commits to `main` — too risky without a human reviewing each change.
