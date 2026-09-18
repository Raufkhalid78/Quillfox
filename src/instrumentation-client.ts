import * as Sentry from '@sentry/nextjs'
import '../sentry.client.config'

// Enables Sentry to instrument client-side navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart