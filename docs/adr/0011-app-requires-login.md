# 0011. The app requires logging in

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

Tasks now live in Supabase and belong to a household. Until now visitors could try the task board without logging
in, with tasks kept in memory on their device. Keeping that mode would mean two task stores and two sets of screens.

## Decision

- Every screen except log-in and household setup is for logged-in family members. `OnboardingGate` (`src/app`) sends
  visitors to log in, then to choose a display name, then to create or join a household.
- Screens behind the gate read the user with `useLoggedInUser()` from `@/lib/auth` and need no logged-out branches.
- New tasks default to the creator's household in the database (`household_id default
private.current_household_id()`), so the tasks feature doesn't depend on the household feature.

## Consequences

- One source of truth for tasks; no data to migrate from a device into an account.
- Trying HomeFlow out takes an email address, a name and a household.
- Past the log-in check the gate never hides the app while loading, so a failed request can't lock a user out.

## Alternatives considered

- Keep a logged-out "try it out" board in memory — duplicate code paths, and tasks lost on reload confuse more than
  they help.
