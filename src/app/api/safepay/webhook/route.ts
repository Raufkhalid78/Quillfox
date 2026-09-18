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
    const rawSignature =
      req.headers.get('X-SFPY-SIGNATURE') || req.headers.get('x-sfpy-signature')
    const timestamp =
      req.headers.get('X-SFPY-TIMESTAMP') || req.headers.get('x-sfpy-timestamp') || ''

    if (!rawSignature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Clean signature if prefixed with algorithm (e.g., "sha256=...")
    const signature = rawSignature.replace(/^(sha256=|sha512=)/i, '').trim()

    // Safepay can use rawBody or `${timestamp}.${rawBody}`, and secrets can be string or base64
    const secretsToTry: (string | Buffer)[] = [webhookSecret]
    try {
      const decoded = Buffer.from(webhookSecret, 'base64')
      if (decoded.length > 0) secretsToTry.push(decoded)
    } catch {
      // Ignore base64 decoding errors
    }

    const payloadsToTry = [
      rawBody,
      ...(timestamp ? [`${timestamp}.${rawBody}`] : []),
    ]

    const candidates: string[] = []
    for (const secret of secretsToTry) {
      for (const payload of payloadsToTry) {
        candidates.push(
          crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
        )
        candidates.push(
          crypto.createHmac('sha512', secret).update(payload, 'utf8').digest('hex')
        )
      }
    }

    let signatureValid = false
    try {
      const receivedBuffer = Buffer.from(signature, 'hex')
      signatureValid = candidates.some((expected) => {
        const expectedBuffer = Buffer.from(expected, 'hex')
        return (
          expectedBuffer.length === receivedBuffer.length &&
          crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
        )
      })
    } catch (sigErr) {
      console.error('Safepay signature buffer parsing error:', sigErr)
    }

    if (!signatureValid) {
      console.error('Safepay webhook signature mismatch. Received:', signature.slice(0, 10) + '...')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    let event: Record<string, any>
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const eventType = String(event.type || event.event || event.name || '').toLowerCase()
    const data = (event.data || event) as Record<string, any>
    const tracker = (data.tracker || {}) as Record<string, any>
    const metadata = (data.metadata || tracker.metadata || {}) as Record<string, any>

    const isSuccessEvent =
      eventType === 'payment.succeeded' ||
      eventType === 'payment.success' ||
      eventType === 'payment.completed' ||
      eventType === 'subscription.payment.succeeded' ||
      eventType === 'tracker.ended' ||
      eventType === 'tracker.completed' ||
      data.state === 'TRACKER_ENDED'

    if (isSuccessEvent) {
      const orderId =
        (typeof metadata.order_id === 'string' ? metadata.order_id : undefined) ||
        (typeof data.order_id === 'string' ? data.order_id : undefined) ||
        (typeof tracker.order_id === 'string' ? tracker.order_id : undefined)

      let userId =
        (metadata.reference || data.reference || tracker.reference || data.customer?.reference) as string | undefined
      let metaTier = (metadata.tier || data.tier) as string | undefined

      if (orderId) {
        const [maybeTier, ...rest] = orderId.split(':')
        if ((maybeTier === 'premium' || maybeTier === 'ultra') && rest.length > 0) {
          metaTier = maybeTier
          userId = rest.join(':')
        } else if (!userId) {
          userId = orderId
        }
      }

      const planId = (data.plan_id || data.planId) as string | undefined
      const amount = data.amount || tracker.amount || data.display_amount

      let newTier: 'premium' | 'ultra' | null = null
      if (metaTier === 'premium' || metaTier === 'ultra') {
        newTier = metaTier
      } else if (planId && planId === planPremiumId) {
        newTier = 'premium'
      } else if (planId && planId === planUltraId) {
        newTier = 'ultra'
      } else if (amount === 150000 || amount === '1500.00' || amount === 1500) {
        newTier = 'premium'
      } else if (amount === 400000 || amount === '4000.00' || amount === 4000) {
        newTier = 'ultra'
      }

      if (userId && newTier) {
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ tier: newTier, updated_at: new Date().toISOString() })
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
