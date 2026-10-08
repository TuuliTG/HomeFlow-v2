# 0012. Email and password login (for now)

- **Status:** Accepted
- **Date:** 2026-10-08
- **Supersedes:** [0009](0009-passwordless-email-login.md)

## Context

ADR 0009 chose emailed one-time codes. Supabase's built-in email sender only reaches project members, is
rate-limited and (on the free plan) can't use our template, so emails had only a link. On iPhone that link opens
Safari, not the home-screen app, so the installed app could not be logged into. We don't want another processor
(an SMTP provider) yet.

## Decision

- Log in with **email and password** through Supabase Auth; a "Create account" mode signs up first-time users.
  Passwords are at least 8 characters (app and Supabase setting). Supabase stores only a hash.
- **"Confirm email" is off** in Supabase, so signing up needs no email and logs the user in at once.
- The profile (display name only) and data minimisation from ADR 0009 are unchanged.

## Consequences

- Works inside the installed PWA; iOS can save the password in the Keychain. No third party added.
- Email addresses are not verified: someone could sign up with an address that isn't theirs. Family data stays
  protected by household invite codes and RLS.
- Creating an account reveals whether an email is already registered; without email confirmation Supabase can't
  hide this. Accepted for a family app; revisit with email confirmation.
- No password reset by email: the project owner sets a new password with SQL (README). Accounts created with
  emailed codes have no password and need one set the same way.
- Moving back to codes (or adding reset emails) needs custom SMTP; the code template is in git history
  (`supabase/templates/login_code.html`).

## Alternatives considered

- Keep emailed codes and add custom SMTP (e.g. Brevo) — the better end state, but another processor to set up now.
- Usernames instead of emails — Supabase Auth identifies users by email or phone; usernames would need fake emails.
