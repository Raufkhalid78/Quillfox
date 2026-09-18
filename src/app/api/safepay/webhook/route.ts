import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { getSupabaseAdminConfig, getSafepayConfig } from '@/lib/env'

/**
 * Safepay webhook receiver.
 *
 * Configure this URL in the Safepay dashboard (Developers → Endpoints) as
 * `https://<your-domain>/api/safepay/webhook` and subscribe to the `2.0.0`
 * payment events (`payment.succeeded`, `payment.failed`, …). The shared secret
 * shown there goes in `SAFEPAY_WEBHOOK_SECRET`.
 *
 * Safepay signs the raw body with HMAC-SHA512 and sends it in the
 * `X-SFPY-SIGNATURE` header.
 */
export async function POST(req: Request) {
  try {
    const { url: supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig()
    const { webhookSecret, planPremiumId, planUltraId } = getSafepayConfig()

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const rawBody = await req.text()
    const signature =
      req.headers.get('X-SFPY-SIGNATURE') || req.headers.get('x-sfpy-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // The docs specify HMAC-SHA512; accept SHA-256 as well so a signing change
    // on Safepay's side does not silently drop every event.
    const candidates = [
      crypto.createHmac('sha512', webhookSecret).update(rawBody, 'utf8').digest('hex'),
      crypto.createHmac('sha256', webhookSecret).update(rawBody, 'utf8').digest('hex'),
    ]

    const receivedBuffer = Buffer.from(signature, 'hex')
    const signatureValid = candidates.some((expected) => {
      const expectedBuffer = Buffer.from(expected, 'hex')
      return (
        expectedBuffer.length === receivedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
      )
    })

    if (!signatureValid) {
      console.error('Safepay webhook signature mismatch')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    let event: { type?: string; data?: Record<string, unknown> }
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const data = (event.data || {}) as Record<string, unknown>
    const metadata = (data.metadata || {}) as Record<string, unknown>

    // Payment succeeded → grant the tier. The tier and the user reference are
    // attached to the payment session's metadata at checkout time.
    if (event.type === 'payment.succeeded' || event.type === 'subscription.payment.succeeded') {
      const userId = (metadata.reference || data.reference) as string | undefined
      const metaTier = metadata.tier as string | undefined
      const planId = (data.plan_id || data.planId) as string | undefined

      let newTier: 'premium' | 'ultra' | null = null
      if (metaTier === 'premium' || metaTier === 'ultra') {
        newTier = metaTier
      } else if (planId && planId === planPremiumId) {
        newTier = 'premium'
      } else if (planId && planId === planUltraId) {
        newTier = 'ultra'
      }

      if (userId && newTier) {
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

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler failed:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
