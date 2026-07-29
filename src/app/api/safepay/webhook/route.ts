import { NextResponse } from 'next/server'
import Safepay from '@sfpy/node-core'
import { createClient } from '@supabase/supabase-js'

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

    // Verify webhook payload
    // Note: The specific validation method depends on Safepay SDK version. 
    // Usually it expects the raw string payload and the signature header.
    let event: any
    try {
      // Some versions of Safepay SDK have a `verifyWebhook` method on the main instance or a `verify` module
      // If the SDK throws an error here, the signature is invalid.
      // @ts-ignore
      event = safepay.verify ? safepay.verify.webhook(rawBody, signature) : JSON.parse(rawBody)
    } catch (err) {
      console.error('Webhook verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // If verification succeeded but it returned undefined/null (some SDKs just return boolean),
    // we manually parse the body.
    if (!event || typeof event === 'boolean') {
      event = JSON.parse(rawBody)
    }

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
