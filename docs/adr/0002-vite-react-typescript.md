# 0002. Vite + React + TypeScript (strict)

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

HomeFlow is a mobile-first web app that must also work on laptops. The owner knows TypeScript and React. No server-side rendering or SEO needs: the app is behind login.

## Decision

Single-page app built with **Vite + React 19 + TypeScript** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). **React Router** for routing, **TanStack Query** for server state, **Tailwind CSS v4** for styling, **Zod** for runtime validation at boundaries.

## Consequences

- Fast dev loop and static build output that any CDN can host.
- Strict types catch mistakes early, which suits agent-written code.
- No SSR; add later only if a real need appears.

## Alternatives considered

- Next.js — SSR/server features not needed; more moving parts.
- React Native/Expo — native app stores not needed; a PWA covers install.
