# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

Work is done largely by AI agents across many short sessions. Without a written record, the reasons behind choices get lost and are re-argued or silently reversed.

## Decision

Record each significant decision as a short ADR in `docs/adr/` (template: `0000-template.md`). ADRs are immutable once accepted; a change of mind is a new ADR that supersedes the old one.

## Consequences

- Agents and humans can check _why_ before changing direction.
- Small overhead per decision; keep ADRs under ~30 lines.

## Alternatives considered

- Decisions only in PR descriptions — hard to find later.
