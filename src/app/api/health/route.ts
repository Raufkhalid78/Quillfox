import { NextResponse } from 'next/server'
import { getSupabasePublicConfig } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Liveness/readiness probe. Verifies required configuration is present and,
 * optionally, that Supabase is reachable.
 */
export async function GET() {
  const checks: Record<string, 'ok' | 'missing'> = {}

  try {
    getSupabasePublicConfig()
    checks.supabase_public = 'ok'
  } catch {
    checks.supabase_public = 'missing'
  }

  checks.supabase_service_role = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'ok' : 'missing'
  checks.safepay =
    process.env.SAFEPAY_API_KEY && process.env.SAFEPAY_V1_SECRET && process.env.SAFEPAY_WEBHOOK_SECRET
      ? 'ok'
      : 'missing'

  const healthy = checks.supabase_public === 'ok'

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 }
  )
}