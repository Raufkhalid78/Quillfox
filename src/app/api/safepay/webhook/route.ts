import { NextResponse } from 'next/server'
import Safepay from '@sfpy/node-core'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const isProd = process.env.NODE_ENV === 'production' && !!process.env.SAFEPAY_API_KEY;
    const environment = isProd ? 'production' : 'sandbox';
    const host = isProd ? 'https://api.getsafepay.com' : 'https://sandbox.api.getsafepay.com';
    const secretKey = process.env.SAFEPAY_API_KEY || 'sec_dummy_key_for_dev';

    const safepay = new Safepay(secretKey, {
      authType: 'secret',
      host: host,
    })
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
    const rawBody = await req.text()
    const signature = req.headers.get('X-SFPY-Signature') || req.headers.get('x-sfpy-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const webhookSecret = process.env.SAFEPAY_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error('Webhook secret is not configured in environment variables.')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Safepay calculates HMAC-SHA256 of the raw body using the secret key
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex')

    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    const receivedBuffer = Buffer.from(signature, 'hex')

    // Avoid timing attacks
    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      console.error('Webhook signature mismatch', { expected: expectedSignature, received: signature })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(rawBody)

    console.log('Safepay webhook received:', event.type)

    const data = event.data || event

    // Handle Subscription Creation or Payment Success
    if (event.type === 'subscription.created' || event.type === 'payment.success') {
      // We expect the user ID to be passed as 'reference' or 'metadata.reference'
      const userId = data.reference || (data.metadata && data.metadata.reference)
      const planId = data.planId || data.plan_id
      
      if (userId) {
        let newTier = 'free'
        
        // Determine tier based on the plan ID that was purchased
        if (planId === process.env.SAFEPAY_PLAN_PREMIUM_ID) {
          newTier = 'premium'
        } else if (planId === process.env.SAFEPAY_PLAN_ULTRA_ID) {
          newTier = 'ultra'
        }

        if (newTier !== 'free') {
          // Update the user's tier in the profiles table
          const { error } = await supabaseAdmin
            .from('profiles')
            .update({ tier: newTier })
            .eq('id', userId)

          if (error) {
            console.error('Error updating user profile tier:', error)
            return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook handler failed:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
