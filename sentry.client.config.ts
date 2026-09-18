import * as Sentry from '@sentry/nextjs'
import { sentryCommonOptions } from '@/lib/sentry-options'

Sentry.init({
  ...sentryCommonOptions,
  integrations: [
    // Replay is client-only. Keep session sampling low; capture all error sessions.
    Sentry.replayIntegration(),
  ],
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
})