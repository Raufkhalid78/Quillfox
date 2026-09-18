import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdminConfig } from '@/lib/env'

/**
 * Self-service downgrade to the free plan.
 *
 * Plan writes are server-only: upgrades go through the Safepay webhook and
 * downgrades through this route. A browser client must never be able to write
 * profiles.tier directly (enforced by RLS).
 */
export async function POST(req: Request) {
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig()
    const supabaseAdmin = createClient(url, serviceRoleKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice('Bearer '.length)
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ tier: 'free', trial_ends_at: null })
      .eq('id', user.id)

    if (error) {
      console.error('Downgrade failed:', error.message)
      return NextResponse.json({ error: 'Failed to downgrade plan' }, { status: 500 })
    }

    return NextResponse.json({ tier: 'free' })
  } catch (error) {
    console.error('Downgrade error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}