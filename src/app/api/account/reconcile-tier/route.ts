import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdminConfig } from '@/lib/env'

/**
 * Reconciles a user's plan tier server-side.
 *
 * Called by the client after profile sync. The server — not the client — decides
 * whether a trial has expired and performs the downgrade, so a user can never
 * self-upgrade by calling profiles.update({ tier }) from the browser (which RLS
 * should also block; see supabase migrations).
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

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('tier, trial_ends_at')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Tier reconcile lookup failed:', error.message)
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
    }

    let tier = (profile?.tier as string) || 'free'
    if (profile?.trial_ends_at && tier !== 'free') {
      if (Date.now() > new Date(profile.trial_ends_at).getTime()) {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ tier: 'free', trial_ends_at: null })
          .eq('id', user.id)

        if (!updateError) {
          tier = 'free'
        }
      }
    }

    let mappedTier: 'free' | 'premium' | 'ultra' = 'free'
    if (tier === 'pro' || tier === 'premium') mappedTier = 'premium'
    else if (tier === 'ultra') mappedTier = 'ultra'

    return NextResponse.json({ tier: mappedTier, trialExpired: tier === 'free' })
  } catch (error) {
    console.error('Tier reconcile error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}