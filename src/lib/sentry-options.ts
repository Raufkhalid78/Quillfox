import type { ErrorEvent, EventHint } from '@sentry/nextjs'

/**
 * Shared Sentry options for all runtimes (client, server, edge).
 * Keeps sampling, environment tagging and PII scrubbing consistent.
 */
export const sentryCommonOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sample only a fraction of traces in production to control cost/overhead.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  sendDefaultPii: false,
  beforeSend(event: ErrorEvent, _hint: EventHint) {
    // Defensive scrub of anything that could carry secrets/user content.
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
      delete event.request.headers['x-sfpy-signature']
    }
    if (event.user) {
      delete event.user.ip_address
      delete event.user.email
    }
    return event
  },
}