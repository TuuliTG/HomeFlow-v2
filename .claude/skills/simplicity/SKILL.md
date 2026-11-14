---
name: simplicity
description: Simplicity and minimalism round for every HomeFlow UI change — strip words, controls, borders and decoration the screen doesn't need, then check again until nothing more can go. Use after implementing any change that touches what users see, before housekeeping.
---

# Simplicity round

HomeFlow aims for a simple, minimalistic UI (`AGENTS.md`). Every UI change gets this round, the way code gets a
refactoring pass.

1. **Review** — delegate to the `ui-simplicity-reviewer` agent (an independent look works best), or walk the
   checklist below yourself on the changed screens. Look at the screen at ~390px wide, not only the diff.
2. **Simplify** — act on the findings in small commits, separate from the feature commit
   (`refactor: drop the helper text under the task title`, or `feat:`/`fix:` when what users see changes).
   Keep tests green; update locale strings in every language.
3. **Repeat** — review again until the round finds nothing worth removing. Two rounds are usually enough.
4. **Stop at clarity** — never trade away accessibility (labels, roles, contrast, ≥ 44px tap targets) or make an
   action hard to find. A word that prevents a wrong tap stays.

## Checklist

- **Words** — Is every heading, label, hint and sentence needed? Shorter wording? Repeats what the screen already shows?
- **Controls** — Can a control go, merge with another, or only appear when it's relevant? One obvious primary action per screen.
- **Icons** — Would a clear icon (with `aria-label`) replace a text button? Is an icon only decoration? Drop it.
- **Visual noise** — Extra borders, cards inside cards, dividers, shadows, colours or font weights that carry no meaning.
- **Density** — Spacing consistent with nearby screens; nothing crammed, nothing padded out.
- **Consistency** — Reuse `src/components/ui` patterns instead of a new variant of an existing one.
- **States** — Empty, loading and error states as short and calm as the main state.
