# 0009. Passwordless email login with a minimal profile

- **Status:** Superseded by 0012
- **Date:** 2026-10-07

## Context

Families need accounts so tasks can be shared across devices. HomeFlow is used in the EU, so login must meet GDPR
with as little personal data, extra processors and security risk as possible, and be simple to build. There are no
child accounts yet.

## Decision

Use **Supabase Auth with emailed one-time codes** (no passwords, no social login). The user enters an email, then the
code from the email; the account is created on first login. The same email also has a link to `/login` that works on
the device where it's opened. Codes rather than links are the main path, because a link opened from a mail app does not
reach an installed PWA.

Store only what the app needs: the **email** (in Supabase Auth) and a **display name** in `public.profiles`, readable
and writable only by its owner (RLS) and deleted with the auth user (`on delete cascade`). The session is kept in
localStorage by supabase-js; it is strictly necessary, so it needs no cookie consent. Host the Supabase project in
an **EU region**.

## Consequences

- No password storage, resets or leaks. Personal data is limited to email + name.
- Supabase (and Vercel for hosting) are processors: accept their DPAs. Supabase's built-in email sender only reaches
  project team members and is rate-limited, so real users need custom SMTP (prefer an EU provider).
- Each login needs access to email. Account deletion (GDPR right to erasure) is not built yet; the cascade makes it a
  single `auth.users` delete.
- Child accounts will need their own decision (no email, parental consent).

## Alternatives considered

- Email + password — password handling and resets for no gain at this size.
- Google/Apple sign-in — adds a processor that learns who uses HomeFlow, and needs provider setup.
- Magic link only — doesn't reach an installed PWA on iOS.
