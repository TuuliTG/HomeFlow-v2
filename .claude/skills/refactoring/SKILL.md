---
name: refactoring
description: Safe refactoring procedure — behaviour-preserving changes in small steps under green tests, committed separately. Use when restructuring code, removing duplication, or acting on housekeeping findings.
---

# Refactoring

1. **Green first** — run the relevant tests; if coverage of the code is weak, add characterization tests before
   changing it.
2. **Small steps** — one refactoring at a time (rename, extract function/component, move module, inline, replace
   conditional with lookup/union). Run tests after each.
3. **No behaviour change** — refactor commits must not alter what users see or what APIs return. If you find a bug,
   note it and fix it in a separate `fix:` commit.
4. **Separate commits** — `refactor: extract TaskCard from AvailableTasksPage`. Never mix with `feat:`/`fix:` in one commit.
5. **Finish cleanly** — remove now-unused code (`npm run knip`), update comments and imports, run `npm run verify`.
6. **Scope** — stay within the area you're working in. Larger restructurings get their own branch (`refactor/…`) and,
   if they change conventions, an ADR.

Common smells to act on: duplicated logic, long component with several responsibilities, prop drilling > 2 levels,
boolean-flag parameters, feature reaching into another feature's internals, business rules inside components.
