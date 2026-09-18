/**
 * Centralized environment variable validation.
 *
 * Server-only module. Never import from a "use client" component.
 * Fails fast on missing required configuration in production so that
 * misconfigured deploys never silently fall back to dummy/placeholder values.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Set it in your deployment environment (see .env.example).'
    )
  }
  return value
}

function optional(name: string, value: string | undefined, fallback: string): string {
  if (!value || value.trim().length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable in production: ${name}.`)
    }
    return fallback
  }
  return value
}

export const isProduction = process.env.NODE_ENV === 'production'

/** Public Supabase config (safe to expose to the browser). */
export function getSupabasePublicConfig() {
  return {
    url: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  }
}

/** Server-only Supabase service role client config. */
export function getSupabaseAdminConfig() {
  return {
    url: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  }
}

/** Safepay payment provider config. */
export function getSafepayConfig() {
  // Never fall back to a dummy key — a missing key must hard fail.
  const apiKey = required('SAFEPAY_API_KEY', process.env.SAFEPAY_API_KEY)
  const isProd = isProduction
  return {
    apiKey,
    environment: (isProd ? 'production' : 'sandbox') as 'production' | 'sandbox',
    host: isProd ? 'https://api.getsafepay.com' : 'https://sandbox.api.getsafepay.com',
    webhookSecret: required('SAFEPAY_WEBHOOK_SECRET', process.env.SAFEPAY_WEBHOOK_SECRET),
    planPremiumId: process.env.SAFEPAY_PLAN_PREMIUM_ID,
    planUltraId: process.env.SAFEPAY_PLAN_ULTRA_ID,
  }
}

/** Public app URL used to build redirect/cancel URLs. */
export function getAppUrl(): string {
  const url = optional('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL, 'http://localhost:3000')
  return url.replace(/\/$/, '')
}