# 0003. Accounts and households

- **Updated:** 2026-11-07

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
  without look-alikes, for adults only (`household_invite_code()`; members can't select the column). Members see
  each other's display names and nothing else about each other.
- **Children**: `household_members.is_child`. Members join as adults; on the household page an adult marks another
  member as a child or back with `set_member_is_child()` (security definer). Children can't change it, and nobody
  changes themselves, so a household always keeps an adult (the caller's row is locked, so two adults can't make
  each other children at once). Children see only tasks for children (ADR 0004).
- **What children may do**: by default only the family's tasks for children. An adult can let a child add tasks
  (`can_add_tasks`, ADR 0004), e.g. an older child who wants private tasks of their own. It is off for every child
  at first, including children from before it existed, and kept if a child is made an adult and back. Only adults
  add and delete goals (ADR 0007).
- **Children without email**: an adult adds one by name on the household page. The `add-child` Edge Function
  creates their Supabase Auth user with an address that can't receive mail (`<uuid>@child.homeflow.invalid`) and
  no password, then `add_child()` (service role only) adds them as a child with `signs_in_with_code`. They sign in
  on their own device with a one-time code: 8 characters like an invite code, stored hashed in
  `private.child_sign_in_codes`, one per child, valid once for 15 minutes. The `child-sign-in` Edge Function takes
  it (`take_child_sign_in_code()`) and answers with a magic-link token made without sending anything, which the app
  passes to `verifyOtp`. Adults make a new code (`new_child_sign_in_code()`), e.g. for a new device or after
  logging out; only for children added this way, so nobody signs in as a member with their own password. No email
  or password is stored for the child, and an adult (the parent) creates the account.
- **Several accounts on one device**, for a child without a device of their own. On the household page an adult
  ticks "On this device" for a child without email: the app makes a sign-in code and takes it at once on a
  throwaway in-memory client, so the adult stays in use. Accounts not in use wait in `localStorage`
  (`homeflow:deviceAccounts`: their tokens and display name); unticking ends the child's session and forgets it
  here. The menu under the name switches back and forth with one tap, no password (the owner's
  choice: no worse than handing over a logged-in phone). Each account keeps its own Supabase session, so RLS always
  sees whoever uses the app. A kept session is tried on a throwaway in-memory client first (the app's own client
  logs out the user in use when it meets an ended session), then handed to the app's client with `setSession()`.
  The query cache is dropped and the screens start afresh on every switch. A kept account is forgotten only when
  Supabase says its session has ended; otherwise (offline, rate limited) it is kept to try again. Logging out
  ends only the account in use, and leaves the device subscribed to push while others stay signed in; the login
  page offers to continue as the others.
- **RLS scopes family data** with `household_id = (select private.current_household_id())`, a security-definer
  helper in the unexposed `private` schema.

## Consequences

- Works inside the installed PWA; no extra processor. Emails aren't verified, and there is no password reset by email
  (the owner resets passwords with SQL, see README). Both need custom SMTP to fix.
- A child with their own email still joins as an adult until an adult marks them.
- A child without email who logs out, or whose device storage is cleared, needs a new code from an adult. Guessing
  a code means trying a share of 32^8 (about 10^12) codes within 15 minutes, fewer the more codes are live at once;
  there is no further rate limit.
- Invite codes can't be rotated yet; there is no leaving a household or deleting an account in the app.
- Anyone holding a device can switch to every account signed in on it, adults included. Kept tokens are as
  exposed as Supabase's own session in `localStorage`. The device's push notifications stay with whoever turned
  them on, or last opened Settings (ADR 0005), not with the account in use; after that account logs out, nobody
  gets them on the device until someone opens Settings.
- Only children without email can be added to a device this way; another adult's account still means logging out.
- Supporting several households per user means replacing `current_household_id()` and the unique membership.

## Alternatives considered

- Emailed codes or magic links (need custom SMTP to reach the installed app), Google/Apple sign-in (another
  processor), email invitations (store invitees' emails before they consent).
- For children: Supabase anonymous sign-in (a cleared device loses the account and its history), a name and PIN
  (easy to guess, easy to forget), profiles without their own login switched on a parent's phone (RLS needs
  each member's own session; kept sessions do that instead). Asking for the adult's password to switch back
  (safer from a child, but slower; may come later).
