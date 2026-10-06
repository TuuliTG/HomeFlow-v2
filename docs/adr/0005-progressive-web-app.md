# 0005. Progressive Web App

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

Most use happens on phones; an app-like, home-screen experience lowers friction (a key user requirement: low effort).

## Decision

Ship as a **PWA** using `vite-plugin-pwa` (manifest, icons, auto-updating service worker). Icons are generated from `public/logo.svg` with `npm run generate-pwa-assets`.

## Consequences

- Installable on iOS/Android without app stores.
- Service worker caching must be considered when debugging stale content.

## Alternatives considered

- Native app — much higher cost, no current need.
