---
name: security
description: Security rules for HomeFlow — Supabase RLS, secrets, input validation, XSS, auth and dependencies. Use when touching data access, auth, user input, dependencies, or before any PR.
---

# Security

## Data access (Supabase)

- **Every table has RLS enabled** in the same migration that creates it, with policies scoped to the user's family
  (`auth.uid()` membership). No table without policies; never `using (true)` for writes.
- Only the **anon key** is used in the browser. The service-role key never appears in client code, env vars prefixed
  `VITE_`, or the repo.
- Treat the client as untrusted: points, ownership and permissions must be enforced in the database (RLS, constraints,
  or Postgres functions), not only in UI.
- Children's accounts: least privilege; no personal data beyond a display name/avatar.

## Input & output

- Validate all external input with Zod (forms, URL params, API responses, localStorage).
- Never use `dangerouslySetInnerHTML`, `eval`, or build URLs from user input without validation.
- Limit lengths of user text (task names, comments).

## Secrets & config

- No secrets in code, tests, logs or commits. `.env*` are gitignored; only `.env.example` is committed.
- Don't log tokens or personal data. `console.log` is a lint error.

## Dependencies

- Add dependencies sparingly; prefer well-maintained, widely used packages. Exact versions are pinned (`.npmrc`).
- npm 11 blocks install scripts by default — only approve (`npm install-scripts approve`) when you understand why
  a package needs one.
- CI runs `npm audit`, dependency review and CodeQL; fix findings rather than ignoring them.

## Before PR

Check the diff against: auth bypass, missing RLS, unvalidated input, XSS, secrets, overly broad CORS/storage
policies, new dependencies (justify in PR, ADR if significant).
