# 0010. Households and shared tasks

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

Tasks must be shared within a family across devices, and kept private from every other family. Joining a family has
to be low effort and must not let anyone add themselves to a family they weren't invited to.

## Decision

- Tables `households` (name, invite code), `household_members` (household ↔ user) and `tasks` (belongs to a
  household, `created_by` the user). **A user is in at most one household** (`unique (user_id)`).
- Family data is scoped in RLS with `household_id = (select private.current_household_id())`, a security-definer
  helper in the non-exposed `private` schema (avoids recursive policies on `household_members`).
- Households are created and joined only via `create_household(name)` and `join_household(invite_code)`
  (security definer); there is no direct write access to `households` or `household_members`. Invite codes are 8
  random characters without look-alikes, shared in person or by message.
- Members can read each other's display names (`profiles`), nothing else about each other.
- Least privilege: members can only read and add tasks for now; `created_by`/`created_at` always come from defaults.
  Updates/deletes get their own policies when a feature needs them. (Marking a task done goes through
  `complete_task()` instead, [ADR 0015](0015-repeating-tasks.md).)

## Consequences

- One household per user keeps "my family" unambiguous in UI and policies; supporting several later means replacing
  `current_household_id()` and the unique constraint.
- Anyone with an invite code can join; codes can't be rotated or revoked yet, and there is no leaving or removing.
- Tasks survive their creator's account deletion (`created_by` becomes null); a household with no members is left
  behind until account deletion is built.

## Alternatives considered

- Email invitations — needs email sending and stores invitees' emails before they consent.
- Membership checks with a plain subquery in each policy — recursive RLS on `household_members` and repetition.
