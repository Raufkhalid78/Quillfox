import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { getSupabaseAdminConfig, getSafepayConfig } from '@/lib/env'

export async function POST(req: Request) {
  try {
    const { url: supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig()
    const { webhookSecret, planPremiumId, planUltraId } = getSafepayConfig()

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const rawBody = await req.text()
    const signature = req.headers.get('X-SFPY-Signature') || req.headers.get('x-sfpy-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Safepay calculates HMAC-SHA256 of the raw body using the webhook secret.
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex')

    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    const receivedBuffer = Buffer.from(signature, 'hex')

    // Timing-safe compare; never log the expected signature.
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      console.error('Safepay webhook signature mismatch')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    let event: { type?: string; data?: Record<string, unknown> } & Record<string, unknown>
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const data = (event.data || event) as Record<string, unknown>

    if (event.type === 'subscription.created' || event.type === 'payment.success') {
      const userId = (data.reference || (data.metadata as Record<string, unknown> | undefined)?.reference) as
        | string
        | undefined
      const planId = (data.planId || data.plan_id) as string | undefined

      if (userId) {
        let newTier: 'free' | 'premium' | 'ultra' = 'free'
        if (planId && planId === planPremiumId) {
          newTier = 'premium'
        } else if (planId && planId === planUltraId) {
          newTier = 'ultra'
        }

        if (newTier !== 'free') {
          const { error } = await supabaseAdmin
            .from('profiles')
            .update({ tier: newTier })
            .eq('id', userId)

          if (error) {
            console.error('Error updating user profile tier:', error.message)
            return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler failed:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}