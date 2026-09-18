import { NextResponse } from 'next/server'
import Safepay from '@sfpy/node-core'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getSupabaseAdminConfig, getSafepayConfig, getAppUrl } from '@/lib/env'

const TIER_AMOUNTS: Record<string, number> = {
  premium: 1500,
  ultra: 4000,
}

const checkoutSchema = z.object({
  tier: z.enum(['premium', 'ultra']),
})

export async function POST(req: Request) {
  try {
    const { url: supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig()
    const { publicApiKey, secretKey, environment, host } = getSafepayConfig()

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Authenticate the caller via their Supabase access token.
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

    // Validate and constrain input.
    const body = await req.json().catch(() => null)
    const parsed = checkoutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid tier specified' }, { status: 400 })
    }

    const { tier } = parsed.data
    const amount = TIER_AMOUNTS[tier]
    const userId = user.id

    // The SDK authenticates with the secret key; the session is created with
    // the public API key.
    const safepay = new Safepay(secretKey, { authType: 'secret', host })

    const appUrl = getAppUrl()
    const cancelUrl = `${appUrl}/dashboard/pricing?canceled=true`
    const redirectUrl = `${appUrl}/dashboard/pricing?success=true`

    // 1. Create a payment session (Tracker)
    const sessionResponse = await safepay.payments.session.setup({
      merchant_api_key: publicApiKey,
      intent: 'CYBERSOURCE',
      mode: 'payment',
      currency: 'PKR',
      amount: amount * 100, // lowest denomination (paisa)
    })

    const trackerToken = sessionResponse.data.token

    // 2. Create an authentication token (Passport)
    const passportResponse = await safepay.client.passport.create()
    const tbtToken = passportResponse.data.token

    // 3. Generate the Checkout URL, binding the user id as the reference.
    const checkoutUrl = safepay.checkout.createCheckoutUrl({
      env: environment,
      tracker: trackerToken,
      tbt: tbtToken,
      source: 'hosted',
      user_id: userId,
      cancel_url: cancelUrl,
      redirect_url: redirectUrl,
    })

    return NextResponse.json({ url: checkoutUrl })
  } catch (error) {
    // Log server-side only; never return internal error details to the client.
    console.error('Safepay checkout error:', error)
    return NextResponse.json({ error: 'Unable to start checkout. Please try again.' }, { status: 500 })
  }
}