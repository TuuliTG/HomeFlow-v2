# 0004. Vercel hosting, GitHub Actions as quality gate

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

We want per-change previews testable on a phone and production updated only from green `main`.

## Decision

**GitHub Actions** runs CI (format, lint, types, knip, unit tests, build, e2e, audit) and **CodeQL** on every PR. `main` is branch-protected: changes land only via PR with passing checks. **Vercel** builds a preview URL per PR and deploys production on merge to `main`.

## Consequences

- Every PR can be tried on a real phone before merging.
- No servers to maintain; free tier is enough for now.

## Alternatives considered

- Netlify — equivalent; Vercel chosen for its GitHub integration.
- GitHub Pages — no per-PR previews.
