// The parts of the Sentry SDK monitoring.ts uses. Loading this module instead of the whole package lets the build leave
// out the rest (session replay, user feedback, tracing).
export { captureException, init } from '@sentry/react';
