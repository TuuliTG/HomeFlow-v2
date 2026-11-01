/** What vite-plugin-pwa's `updateServiceWorker()` posts to the waiting service worker (`src/sw.ts`). */
export function isSkipWaitingMessage(data: unknown): boolean {
  return (
    typeof data === 'object' && data !== null && 'type' in data && data.type === 'SKIP_WAITING'
  );
}
