import { NextResponse } from 'next/server'
import Safepay from '@sfpy/node-core'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getSupabaseAdminConfig, getSafepayConfig } from '@/lib/env'

const verifySchema = z.object({
  tracker: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const { url: supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig()
    const { secretKey, host } = getSafepayConfig()
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Authenticate the user
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

    const body = await req.json().catch(() => ({}))
    const parsed = verifySchema.safeParse(body)
    const tracker = parsed.success ? parsed.data.tracker : undefined

    const safepay = new Safepay(secretKey, { authType: 'secret', host })

    let verifiedTier: 'premium' | 'ultra' | null = null

    // 1. If a tracker token was passed from the return URL
    if (tracker) {
      try {
        const response = await safepay.reporter.payments.fetch(tracker)
        const payment = response?.data || response
        if (payment && (payment.state === 'TRACKER_ENDED' || payment.status === 'completed')) {
          const metadata = payment.metadata || {}
          const orderId = metadata.order_id || payment.order_id
          if (typeof orderId === 'string' && orderId.includes(':')) {
            const [t, uid] = orderId.split(':')
            if ((t === 'premium' || t === 'ultra') && uid === user.id) {
              verifiedTier = t
            }
          } else if (orderId === 'premium' || metadata.tier === 'premium') {
            verifiedTier = 'premium'
          } else if (orderId === 'ultra' || metadata.tier === 'ultra') {
            verifiedTier = 'ultra'
          } else if (payment.display_amount === '1500.00' || payment.amount === 150000) {
            verifiedTier = 'premium'
          } else if (payment.display_amount === '4000.00' || payment.amount === 400000) {
            verifiedTier = 'ultra'
          }
        }
      } catch (err) {
        console.warn('Safepay fetch tracker error:', err)
      }
    }

    // 2. If tracker wasn't provided or didn't yield a tier, check recent Safepay payments for this user
    if (!verifiedTier) {
      try {
        const listResponse = await safepay.reporter.payments.search({ limit: 10 })
        const list = listResponse?.data?.list || []
        for (const payment of list) {
          if (payment.state === 'TRACKER_ENDED') {
            const metadata = payment.metadata || {}
            const orderId = metadata.order_id || payment.order_id
            if (typeof orderId === 'string' && orderId.includes(':')) {
              const [t, uid] = orderId.split(':')
              if ((t === 'premium' || t === 'ultra') && uid === user.id) {
                verifiedTier = t
                break
              }
            }
          }
        }
      } catch (err) {
        console.warn('Safepay search payments error:', err)
      }
    }

    // 3. Update profile if a tier was verified
    if (verifiedTier) {
      await supabaseAdmin
        .from('profiles')
        .update({ tier: verifiedTier, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      return NextResponse.json({ success: true, tier: verifiedTier })
    }

    // 4. Return current tier from profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single()

    const currentTier = profile?.tier === 'ultra' || profile?.tier === 'ultra_premium' ? 'ultra' : profile?.tier === 'premium' ? 'premium' : 'free'

    return NextResponse.json({ success: currentTier !== 'free', tier: currentTier })
  } catch (error) {
    console.error('Verify payment error:', error)
    return NextResponse.json({ error: 'Unable to verify payment' }, { status: 500 })
  }
}
