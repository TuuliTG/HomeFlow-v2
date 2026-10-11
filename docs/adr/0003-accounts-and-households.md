# 0003. Accounts and households

- **Updated:** 2026-10-11

## Context

Families share tasks across devices and must never see each other's data. HomeFlow is used in the EU, so it keeps as
little personal data as possible, and joining a family must be low effort without letting strangers in.

## Decisions

- **Email and password** through Supabase Auth, "Confirm email" off, passwords ≥ 8 characters. Emailed codes were
  tried first, but without custom SMTP their links open Safari instead of the installed iPhone app.
- **Minimal data**: the email (in Supabase Auth) and a display name (`profiles`), deleted with the user. Supabase
  project in an EU region.
- **The app requires logging in.** `OnboardingGate` (`src/app`) leads visitors to log in, choose a name, then create
  or join a household. Screens behind it use `useLoggedInUser()` from `@/lib/auth`.
- **One household per user.** `households`, `household_members`; created and joined only through
  `create_household(name)` and `join_household(invite_code)` (security definer). Invite codes: 8 random characters
  without look-alikes. Members see each other's display names and nothing else about each other.
- **Children**: `household_members.is_child`. Members join as adults; on the household page an adult marks another
  member as a child or back with `set_member_is_child()` (security definer). Children can't change it, and nobody
  changes themselves, so a household always keeps an adult. Children see only tasks for children (ADR 0004). No
  separate accounts or invite codes for children: the product brief asks only that adults opt children in.
- **RLS scopes family data** with `household_id = (select private.current_household_id())`, a security-definer
  helper in the unexposed `private` schema.

## Consequences

- Works inside the installed PWA; no extra processor. Emails aren't verified, and there is no password reset by email
  (the owner resets passwords with SQL, see README). Both need custom SMTP to fix.
- A child sees every task until an adult marks them, since they join as an adult.
- Invite codes can't be rotated yet; there is no leaving a household or deleting an account in the app.
- Supporting several households per user means replacing `current_household_id()` and the unique membership.

## Alternatives considered

- Emailed codes or magic links (need custom SMTP to reach the installed app), Google/Apple sign-in (another
  processor), email invitations (store invitees' emails before they consent).
